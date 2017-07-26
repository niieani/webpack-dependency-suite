import * as path from 'path'
import * as fs from 'fs'
import {promisify} from 'util'
import * as resolve from 'enhanced-resolve'
import {
  LoggingCallbackWrapper,
  ResolveContext
} from "enhanced-resolve/lib/common-types";

type ResolverInstance = {
  (path: string, request: string, callback: LoggingCallbackWrapper): void;
  (context: ResolveContext, path: string, request: string, callback: LoggingCallbackWrapper): void;
}

export type Prefix = string | false | ((moduleId: string) => string)
export type LoaderInfo = { loader: string, prefix: Prefix }
type LoaderInfoResolve = Pick<EnhancedResolve.ResolveResult, 'path'> & LoaderInfo
type LoaderInfoError = {error: Error | null | undefined} & LoaderInfo

export type DuplicateHandler = (proposedModuleId: string, module: Webpack.Core.NormalModule, modules: Webpack.Core.NormalModule[], previouslyAssigned: Map<string, Webpack.Core.NormalModule>, retryCount: number) => string

function resolveLoader(compiler, origin, contextPath, loaderInfo: LoaderInfo, resolver: ResolverInstance) {
  return new Promise<LoaderInfoResolve | LoaderInfoError>((resolve, reject) =>
    resolver(origin, contextPath, loaderInfo.loader, (error, resolvedPath, resolveObj) =>
      (error || !resolveObj) ? (resolve({error, ...loaderInfo}) || console.error(`No loader resolved for '${loaderInfo.loader}'`)) :
      resolve({...resolveObj, ...loaderInfo})
    )
  )
}

/**
 * Small description of how this plugin creates moduleIds:
  *  uses module.rawRequest if it doesn't start with '.' or '!' and isn't path.isAbsolute
  *  otherwise makes module ID relative to appDir
  *  if necessary (see after rawRequest impl.):
  *  cuts out '...../node_modules', in case it's nested, cut that nesting too
  *  if the another module of the SAME name already exists, sends a WARNING
  *  checks module.loaders[x].loader (that's a path) for loaders that need prefixing
  *  then name looks e.g. like: 'async!whatever/lalala'
  *  compares pure path with rawRequest and optionally LOGs if different
  *
  *  to use in a dynamic loader test: if ('async!my-thing' in __webpack_require__.m)
  *  then based on existence: handle e.g. __webpack_require__('async!my-thing')
  *
  *  run optional path convertion methods (moduleId) => string
  *  e.g. to strip .../dist/native-modules/...
  */
export class MappedModuleIdsPlugin {
  constructor (public options: {
    appDir: string
    prefixLoaders: Array<LoaderInfo>
    dotSlashWhenRelativeToAppDir?: boolean
    beforeLoadersTransform?: (currentModuleId: string, module?: Webpack.Core.NormalModule) => string
    afterLoadersTransform?: (currentModuleId: string, module?: Webpack.Core.NormalModule) => string
    afterExtensionTrimmingTransform?: (currentModuleId: string, module?: Webpack.Core.NormalModule) => string
    keepAllExtensions?: boolean
    logWhenRawRequestDiffers?: boolean
    warnOnNestedSubmodules?: boolean
    /**
     * RegExp or function, return true if you want to ignore the module
     */
    ignore?: RegExp | ((module: Webpack.Core.NormalModule) => boolean)
    duplicateHandler?: DuplicateHandler
    errorOnDuplicates?: boolean
    useManualResolve?: boolean | 'node-fs' // uses node's filesystem instead of Webpack's builtin
  }) {
    const ignore = options.ignore
    if (ignore) {
      this.ignoreMethod = typeof ignore === 'function' ? ignore : (module) => {
        return ignore.test(module.rawRequest)
      }
    }
  }

  ignoreMethod: ((module: Webpack.Core.NormalModule) => boolean) | undefined

  apply(compiler) {
    const {options} = this
    if (!options.appDir) {
      options.appDir = compiler.options.context
    }

    let resolvedLoaders = [] as Array<LoaderInfoResolve>
    const fileSystem = options.useManualResolve && options.useManualResolve !== 'node-fs' && (compiler.inputFileSystem as typeof fs) || (require('fs') as typeof fs)
    const resolver = options.useManualResolve ? resolve.create({fileSystem, ...compiler.options.resolveLoader}) : undefined

    const beforeRunStep = async (compilingOrWatching, callback) => {
      if (resolvedLoaders.length) {
        // cached from previous resolve
        return callback()
      }
      const webpackLoaderResolver = compiler.resolvers.loader.resolve.bind(compiler.resolvers.loader) as ResolverInstance
      const resolved = await Promise.all(options.prefixLoaders.map(
        (loaderName) => resolveLoader(compiler, {}, compiler.options.context, loaderName, resolver || webpackLoaderResolver)
      ))
      resolvedLoaders = resolved.filter((r: LoaderInfoError) => !r.error) as Array<LoaderInfoResolve>
      return callback()
    }

    compiler.plugin('run', beforeRunStep)
    compiler.plugin('watch-run', beforeRunStep)

    compiler.plugin('compilation', (compilation) => {
      const previouslyAssigned = new Map<string, Webpack.Core.NormalModule>()

      compilation.plugin('before-module-ids', (modules: Array<Webpack.Core.NormalModule>) => {
        modules.forEach((module) => {
          if (module.userRequest && module.rawRequest && module.id === null && (!this.ignoreMethod || !this.ignoreMethod(module))) {
            const userRequest = module.userRequest || ''
            const rawRequest = module.rawRequest || ''
            const requestSep = userRequest.split('!')
            const loadersUsed = requestSep.length > 1
            const userRequestLoaders = requestSep.slice(0, requestSep.length - 1)
            const userRequestLoaderPaths = userRequestLoaders.map(name => {
              const queryStart = name.indexOf('?')
              return (queryStart > -1) ? name.substring(0, queryStart) : name
            })

            const requestedFilePath = requestSep[requestSep.length - 1]
            let moduleId = path.relative(options.appDir, requestedFilePath)
            if (path.sep === '\\')
              moduleId = moduleId.replace(/\\/g, '/')

            const lastMentionOfNodeModules = moduleId.lastIndexOf('node_modules')
            if (lastMentionOfNodeModules >= 0) {
              const firstMentionOfNodeModules = moduleId.indexOf('node_modules')
              if (options.warnOnNestedSubmodules && firstMentionOfNodeModules != lastMentionOfNodeModules) {
                console.warn(`Path is a nested node_modules`)
              }
              // cut out node_modules
              moduleId = moduleId.slice(lastMentionOfNodeModules + 'node_modules'.length + 1)
            } else if (options.dotSlashWhenRelativeToAppDir) {
              moduleId = `./${moduleId}`
            }

            if (options.beforeLoadersTransform) {
              moduleId = options.beforeLoadersTransform(moduleId, module)
            }

            const rawRequestSplit = rawRequest.split(`!`)
            const rawRequestPath = rawRequestSplit[rawRequestSplit.length - 1]
            const rawRequestPathParts = rawRequestPath.split(`/`)

            if (!path.isAbsolute(rawRequestPath) && !rawRequestPath.startsWith(`.`) &&
                  (rawRequestPathParts.length === 1 ||
                  (rawRequestPathParts.length === 2 && rawRequestPathParts[0].startsWith(`@`)))
               ) {
              // we're guessing that this is a call to the package.json/main field
              // we want to keep the module name WITHOUT the full path, so lets try naming this with the request
              moduleId = rawRequestPath
            }

            let loadersAdded = 0
            module.loaders.forEach(loader => {
              const resolved = resolvedLoaders.find(l => l.path === loader.loader)
              const wasInUserRequest = userRequestLoaderPaths.find(loaderPath => loaderPath === loader.loader)
              if (!resolved || resolved.prefix === '' || resolved.prefix === undefined) {
                if (wasInUserRequest) {
                  console.warn(
                    `Warning: Keeping '${rawRequest}' without the loader prefix '${loader.loader}'.` + '\n' +
                    `Explicitly silence these warnings by defining the loader in MappedModuleIdsPlugin configuration`)
                }
                return
              }
              // actively supress prefixing when false
              if (resolved.prefix === false) return
              if (typeof resolved.prefix === 'function') {
                moduleId = resolved.prefix(moduleId)
              } else {
                moduleId = `${resolved.prefix}!${moduleId}`
              }
              loadersAdded++
            })

            if (options.afterLoadersTransform) {
              moduleId = options.afterLoadersTransform(moduleId, module)
            }

            if (!options.keepAllExtensions) {
              const trimExtensions = compiler.options.resolve.extensions as Array<string>
              trimExtensions.forEach(ext => {
                if (moduleId.endsWith(ext)) {
                  moduleId = moduleId.slice(0, moduleId.length - ext.length)
                }
              })
            }

            if (options.afterExtensionTrimmingTransform) {
              moduleId = options.afterExtensionTrimmingTransform(moduleId, module)
            }

            const proposedModuleIdSplit = moduleId.split(`!`)
            const proposedModuleIdPath = proposedModuleIdSplit[proposedModuleIdSplit.length - 1]

            if (options.logWhenRawRequestDiffers && !rawRequestPath.startsWith(`.`) && (proposedModuleIdPath !== rawRequestPath)) { // (!loadersAdded && (moduleId !== module.rawRequest) || ...)
              console.info(`Raw Request Path (${rawRequestPath}) differs from the generated ID (${proposedModuleIdPath})`)
            }

            let retryCount = 0
            while (previouslyAssigned.has(moduleId)) {
              const {
                duplicateHandler = ((moduleId, module, modules, previouslyAssigned, retryCount) => {
                  if (options.errorOnDuplicates) {
                    console.error(`Error: Multiple modules with the same ID: '${moduleId}'`)
                  }
                  return `${moduleId}#${retryCount}`
                }) as DuplicateHandler
              } = options

              moduleId = duplicateHandler(moduleId, module, modules, previouslyAssigned, retryCount)
              retryCount++
            }

            previouslyAssigned.set(moduleId, module)
            module.id = moduleId
          }
        })
      })
    })
  }
}
