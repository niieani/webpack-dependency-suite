import * as path from 'path'

type LoaderInfo = { loader: string, prefix: string | false }
type LoaderInfoResolve = EnhancedResolve.ResolveResult & LoaderInfo
type LoaderInfoError = {error: Error} & LoaderInfo

function resolveLoader(compiler, origin, contextPath, loaderInfo: LoaderInfo) {
  return new Promise<LoaderInfoResolve | LoaderInfoError>((resolve, reject) =>
    compiler.resolvers.loader.resolve(origin, contextPath, loaderInfo.loader, (error, resolvedPath, resolveObj) =>
      error ? resolve(Object.assign({error}, loaderInfo)) || console.error(`No loader resolved for '${loaderInfo.loader}'`) :
      resolve(Object.assign(resolveObj, loaderInfo))
    )
  );
}

export = class MappedModuleIds {
  constructor (public options: {
    appDir: string
    prefixLoaders: Array<LoaderInfo>
    logWhenRawRequestDiffers?: boolean
    dotSlashWhenRelativeToAppDir?: boolean
    beforeLoadersTransform?: (currentModuleId: string, module?: Webpack.Core.NormalModule) => string
    afterLoadersTransform?: (currentModuleId: string, module?: Webpack.Core.NormalModule) => string
    afterExtensionTrimmingTransform?: (currentModuleId: string, module?: Webpack.Core.NormalModule) => string
    keepAllExtensions?: boolean
  }) {}

  apply(compiler) {
    if (!this.options.appDir) {
      this.options.appDir = compiler.options.context
    }

    let resolvedLoaders = [] as Array<LoaderInfoResolve>
    const beforeRunStep = async (compiler, callback) => {
      const resolved = await Promise.all(this.options.prefixLoaders.map(
        (loaderName) => resolveLoader(compiler, {}, compiler.options.context, loaderName)
      ))
      resolvedLoaders = resolved.filter((r: LoaderInfoError) => !r.error) as Array<LoaderInfoResolve>
      callback()
    }

    compiler.plugin('run', beforeRunStep)
    compiler.plugin('watch-run', beforeRunStep)

    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('before-module-ids', (modules: Array<Webpack.Core.NormalModule>) => {
        modules.forEach((module) => {
          if (module.id === null && module.libIdent) {
            // MAYBE:
            //    use module.rawRequest if it doesn't start with '.' or '!' and isn't path.isAbsolute
            //    or compare with rawRequest and LOG if different
            // else/better? use libIdent relative to appDir
            // if necessary (see after rawRequest impl.):
            // cut out and '...../node_modules', in case it's nested, cut that nesting too
            // if the another module of the SAME name already exists, send a WARNING
            // check module.loaders[x].loader (that's a path) for loaders that need prefixing
            // then name: 'bundle!whatever/lalala'
            //
            // in loader test: if ('bundle!my-thing' in __webpack_require__.m)
            // then based on existence: handle e.g. __webpack_require__('bundle!my-thing')
            //
            // run optional pathConvertion(fullPath) => string
            // e.g. to strip .../dist/native-modules/...

            // example output
            // ../../../../node_modules/bundle-loader/index.js?lazy&name=aurelia!./node_modules/aurelia-templating-resources/dist/native-modules/signal-binding-behavior.js

            const requestSep = module.userRequest.split('!')
            const loadersUsed = requestSep.length > 1
            const userRequestLoaders = requestSep.slice(0, requestSep.length - 1)
            const userRequestLoaderPaths = userRequestLoaders.map(name => {
              const queryStart = name.indexOf('?')
              return (queryStart > -1) ? name.substring(0, queryStart) : name
            })

            const requestedFilePath = requestSep[requestSep.length - 1]
            let moduleId = path.relative(this.options.appDir, requestedFilePath)
            if (path.sep === '\\')
              moduleId = moduleId.replace(/\\/g, '/')

            const lastMentionOfNodeModules = moduleId.lastIndexOf('node_modules')
            if (lastMentionOfNodeModules >= 0) {
              const firstMentionOfNodeModules = moduleId.indexOf('node_modules')
              if (firstMentionOfNodeModules != lastMentionOfNodeModules) {
                console.warn(`Path is a nested node_modules`)
              }
              // cut out node_modules
              moduleId = moduleId.slice(lastMentionOfNodeModules + 'node_modules'.length + 1)
            } else if (this.options.dotSlashWhenRelativeToAppDir) {
              moduleId = `./${moduleId}`
            }

            if (this.options.beforeLoadersTransform) {
              moduleId = this.options.beforeLoadersTransform(moduleId, module)
            }

            const rawRequestSplit = module.rawRequest.split(`!`)
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
                if (wasInUserRequest)
                  console.warn(`Warning: Keeping '${module.rawRequest}' without the loader prefix '${loader.loader}'. Explicitly silence these warnings by defining the loader in MappedModuleIds plugin's configuration`)
                return
              }
              // actively supress prefixing when false
              if (resolved.prefix === false) return
              moduleId = `${resolved.prefix}!${moduleId}`
              loadersAdded++
            })

            if (this.options.afterLoadersTransform) {
              moduleId = this.options.afterLoadersTransform(moduleId, module)
            }

            if (!this.options.keepAllExtensions) {
              const trimExtensions = compiler.options.resolve.extensions as Array<string>
              trimExtensions.forEach(ext => {
                if (moduleId.endsWith(ext)) {
                  moduleId = moduleId.slice(0, moduleId.length - ext.length)
                }
              })
            }

            if (this.options.afterExtensionTrimmingTransform) {
              moduleId = this.options.afterExtensionTrimmingTransform(moduleId, module)
            }

            const proposedModuleIdSplit = moduleId.split(`!`)
            const proposedModuleIdPath = proposedModuleIdSplit[proposedModuleIdSplit.length - 1]

            if (this.options.logWhenRawRequestDiffers && !rawRequestPath.startsWith(`.`) && (proposedModuleIdPath !== rawRequestPath)) { // (!loadersAdded && (moduleId !== module.rawRequest) || ...)
              console.info(`Raw Request Path (${rawRequestPath}) differs from the generated ID (${proposedModuleIdPath})`)
            }

            let isDuplicate: Webpack.Core.NormalModule | undefined
            while (isDuplicate = modules.find(m => m.id === moduleId)) {
              console.error(`Error: Multiple modules with the same ID: '${moduleId}'`)
              if (isNaN(parseInt(moduleId[0]))) {
                moduleId = `1-duplicate!${moduleId}`
              } else {
                moduleId = `${parseInt(moduleId[0]) + 1}-duplicate!${moduleId}`
              }
            }

            module.id = moduleId

            // module.id = module.libIdent({
            //   context: compiler.options.context
            // });
            // console.log(module.id)
            // module.id = module.libIdent({
            //   context: this.options.context || compiler.options.context
            // });
          }
        });
      });
    });
  }
}
