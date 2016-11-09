import { AddLoadersMethod, PathWithLoaders, RequireData, RequireDataBase } from './definitions'
import * as path from 'path'
import * as loaderUtils from 'loader-utils'
import * as SourceMap from 'source-map'
import { getFilesInDir, concatPromiseResults, cacheInvalidationDebounce } from './utils'
import ModuleDependency = require('webpack/lib/dependencies/ModuleDependency')
import escapeStringForRegex = require('escape-string-regexp')
import {memoize, uniqBy} from 'lodash'
import * as debug from 'debug'
const log = debug('utils')

export function appendCodeAndCallback(loader: Webpack.Core.LoaderContext, source: string, inject: string, sourceMap?: SourceMap.RawSourceMap, synchronousIfPossible = false) {
  inject += (!source.trim().endsWith(';')) ? ';\n' : '\n'

  // support existing SourceMap
  // https://github.com/mozilla/source-map#sourcenode
  // https://github.com/webpack/imports-loader/blob/master/index.js#L34-L44
  // https://webpack.github.io/docs/loaders.html#writing-a-loader
  if (sourceMap) {
    const currentRequest = loaderUtils.getCurrentRequest(loader)
    const SourceNode = SourceMap.SourceNode
    const SourceMapConsumer = SourceMap.SourceMapConsumer
    const sourceMapConsumer = new SourceMapConsumer(sourceMap)
    const node = SourceNode.fromStringWithSourceMap(source, sourceMapConsumer)

    ;(node as any).append(inject)

    const result = node.toStringWithSourceMap({
      file: currentRequest
    })

    loader.callback(null, result.code, result.map.toJSON())
  } else {
    if (synchronousIfPossible) {
      return inject ? source + inject : source
    } else {
      loader.callback(null, source + inject)
    }
  }
}

export async function splitRequest(literal: string, loaderInstance?: Webpack.Core.LoaderContext) {
  // log(`Split Request: ${literal}`)
  let pathBits = literal.split(`/`)
  let remainingRequestBits = pathBits.slice()
  const literalIsRelative = literal[0] === '.'
  if (!literalIsRelative) {
    const fullPathNdIdx = pathBits.lastIndexOf('node_modules')
    if (fullPathNdIdx >= 0) {
      // conform full hard disk path /.../node_modules/MODULE_NAME/... to just MODULE_NAME/...
      pathBits = pathBits.slice(fullPathNdIdx + 1)
    }
    const moduleNameLength = pathBits[0].startsWith(`@`) ? 2 : 1
    const moduleName = pathBits.slice(0, moduleNameLength).join(`/`)
    // remainingRequest may be globbed:
    let ifModuleRemainingRequestBits = pathBits.slice(moduleNameLength)
    const remainingRequest = ifModuleRemainingRequestBits.join(`/`)
    let moduleRoot = ''
    let tryModule: {
      resolve: EnhancedResolve.ResolveResult | undefined;
    } = { resolve: undefined }
    if (loaderInstance && !moduleName.includes(`*`)) {
      // TODO: test this
      tryModule = await resolveLiteral({ literal: `${moduleName}` }, loaderInstance, undefined, false)
      if (tryModule.resolve && tryModule.resolve.descriptionFileRoot) {
        moduleRoot = tryModule.resolve.descriptionFileRoot
      }
      log(`does module '${moduleName}' exist?: ${tryModule.resolve && 'true' || 'false'}`)
    }
    if (!loaderInstance || tryModule.resolve) {
      return {
        moduleName, moduleRoot, remainingRequest, pathBits, remainingRequestBits: ifModuleRemainingRequestBits
      }
    }
  }
  return { remainingRequest: literal, remainingRequestBits, pathBits, moduleName: '', moduleRoot: '' }
}

export async function expandGlobBase(literal: string, loaderInstance: Webpack.Core.LoaderContext, rootForRelativeResolving: string | false = path.dirname(loaderInstance.resourcePath)) {
  const { pathBits, remainingRequest, remainingRequestBits, moduleName, moduleRoot } = await splitRequest(literal, loaderInstance)
  // const literalIsRelative = literal[0] === '.'
  let possibleRoots = loaderInstance.options.resolve.modules.filter((m: string) => path.isAbsolute(m)) as Array<string>

  const nextGlobAtIndex = remainingRequestBits.findIndex(pb => pb.includes(`*`))
  const relativePathUntilFirstGlob = remainingRequestBits.slice(0, nextGlobAtIndex).join(`/`)
  const relativePathFromFirstGlob = remainingRequestBits.slice(nextGlobAtIndex).join(`/`)

  if (moduleName && moduleRoot) {
    possibleRoots = [moduleRoot]
    // const moduleName = pathBits[0].startsWith(`@`) ? pathBits.slice(0, 2).join(`/`) : pathBits[0]
    // if (moduleRoot) {
      // TODO: add support for aliases when they point to a subdirectory
      // Or maybe the resolve will already include it?
      // const resolved = await resolveLiteral(Object.assign({ literal: moduleName }), loaderInstance, undefined, false /* do not emit warnings for bad resolves here */)
      // const root = resolved.resolve && resolved.resolve.descriptionFileRoot
      // if (root) {
      //   possibleRoots = [root]
      // }
    // }
  } else if (rootForRelativeResolving) {
    // possibleRoots = [path.join(path.dirname(loaderInstance.resourcePath), relativePathUntilFirstGlob)]
    possibleRoots = [rootForRelativeResolving, ...possibleRoots]
  }

  let possiblePaths = await concatPromiseResults(
    possibleRoots.map(async directory => await getFilesInDir(path.join(directory, relativePathUntilFirstGlob), {
      recursive: true, emitWarning: loaderInstance.emitWarning, emitError: loaderInstance.emitError,
      fileSystem: loaderInstance.fs, skipHidden: true
    }))
  )

  possiblePaths = uniqBy(possiblePaths, 'filePath')

  // let nonRelativePath = path.normalize(path.join(literal)) // removes ./ from the path
  // while (nonRelativePath.startsWith('../')) {
  //   loaderInstance.emitWarning(`Combining globbing with parent-path traversal is not supported: '${literal}'`)
  //   nonRelativePath = nonRelativePath.slice(3)
  // }

  // test case: escape('werwer/**/werwer/*.html').replace(/\//g, '[\\/]+').replace(/\\\*\\\*/g, '\.*?').replace(/\\\*/g, '[^/\\\\]*?')
  const globRegexString = escapeStringForRegex(relativePathFromFirstGlob)
    .replace(/\//g, '[\\/]+') // accept Windows and Unix slashes
    .replace(/\\\*\\\*/g, '\.*?') // multi glob ** => any number of subdirectories
    .replace(/\\\*/g, '[^/\\\\]*?') // single glob * => one directory (stops at first slash/backslash)
  const globRegex = new RegExp(`^${globRegexString}$`) // (?:\.\w+)
  const correctPaths = possiblePaths.filter(p => p.stat.isFile() && globRegex.test(p.relativePath))

  return correctPaths.map(p => p.filePath)

/*
  return resolveAllAndConcat<{
    resolve: EnhancedResolve.ResolveResult | undefined;
    literal: string;
  }>(
    correctPaths.map(
      async p => await resolveLiteral({ literal: p.filePath }, loaderInstance)
    )
  )
*/
  // return Object.assign({}, r, { literal })
  // let resolved = await resolveLiteral(Object.assign({}, r, { literal: pathUntilFirstGlob }), loaderInstance)
  // resolved.resolve.path
  // for (let pathBit of pathBits) {
  //   if (!pathBit.includes(`*`)) {
  //     pathUntilFirstGlob += `${pathBit}/`
  //   }
  // }
  // let pathBit = pathBits.shift()
  // while (!pathBit.includes(`*`)) {
  //   pathUntilFirstGlob += `${pathBit}/`
  //   pathBit = pathBits.shift()
  // }
}

const expandGlob = memoize(expandGlobBase, (literal: string, loaderInstance: Webpack.Core.LoaderContext, rootForRelativeResolving = path.dirname(loaderInstance.resourcePath)) => {
  /** valid for 10 seconds for the same literal and resoucePath */
  const cacheKey = `${literal}::${path.dirname(loaderInstance.resourcePath)}::${rootForRelativeResolving}`
  // invalidate every 10 seconds based on each unique Webpack compilation
  cacheInvalidationDebounce(cacheKey, expandGlob.cache, loaderInstance._compilation)
  return cacheKey
})

export async function expandAllRequiresForGlob<T extends { literal: string }>(requires: Array<T>, loaderInstance: Webpack.Core.LoaderContext, rootForRelativeResolving: string | false = path.dirname(loaderInstance.resourcePath), returnRelativeLiteral = false) {
  const needDeglobbing = requires.filter(r => r.literal.includes(`*`))
  const deglobbed = requires.filter(r => !r.literal.includes(`*`))
  const allDeglobbed = deglobbed.concat(await concatPromiseResults(needDeglobbing.map(async r =>
    (await expandGlob(r.literal, loaderInstance, rootForRelativeResolving))
      .map(correctPath => Object.assign({}, r, {
        literal: returnRelativeLiteral ?
          `./${path.relative(path.dirname(loaderInstance.resourcePath), correctPath)}` :
          correctPath
      }))
  )))
  return uniqBy(allDeglobbed, 'literal')
}

export async function getRequireStrings(maybeResolvedRequires: Array<RequireData | { literal: string, resolve?: undefined }>, addLoadersMethod: AddLoadersMethod | undefined, loaderInstance: Webpack.Core.LoaderContext, forceFallbackLoaders = false): Promise<Array<string>> {
  const requires = await Promise.all(maybeResolvedRequires.map(
    async r => !r.resolve ? await resolveLiteral(r, loaderInstance) : r
  )) as Array<RequireData>

  type PathsAndLoadersWithLiterals = PathWithLoaders & {removed?: boolean, literal: string}
  let pathsAndLoaders: Array<PathsAndLoadersWithLiterals>

  if (typeof addLoadersMethod === 'function') {
    const maybePromise = addLoadersMethod(requires, loaderInstance)
    const pathsAndLoadersReturnValue = (maybePromise as Promise<Array<PathWithLoaders>>).then ? await maybePromise : maybePromise as Array<PathWithLoaders>
    pathsAndLoaders = pathsAndLoadersReturnValue.map(p => {
      const rq = requires.find(r => r.resolve.path === p.path)
      if (!rq) return Object.assign(p, {removed: true, literal: undefined})
      return Object.assign(p, { loaders: (p.loaders && !forceFallbackLoaders) ? p.loaders : (rq.loaders || rq.fallbackLoaders || []), literal: rq.literal, removed: false })
    }).filter(r => !r.removed) as Array<PathsAndLoadersWithLiterals>
  } else {
    pathsAndLoaders = requires.map(r => ({ literal: r.literal, loaders: r.loaders || r.fallbackLoaders || [], path: r.resolve.path }))
  }

  // const resourceDir = path.dirname(loaderInstance.resourcePath)
  return pathsAndLoaders.map(p =>
    (p.loaders && p.loaders.length) ?
      `!${p.loaders.join('!')}!${p.literal}` :
      p.literal
      // (`!${p.loaders.join('!')}!` + (p.literal ? p.literal : `./${path.relative(resourceDir, p.path)}`)) :
      // (p.literal ? p.literal : `./${path.relative(resourceDir, p.path)}`)
  )
}

export function wrapInRequireInclude(toRequire: string) {
  return `require.include('${toRequire}');`
}

// TODO: memoize:
export function resolveLiteral<T extends { literal: string }>(toRequire: T, loaderInstance: Webpack.Core.LoaderContext, contextPath = path.dirname(loaderInstance.resourcePath) /* TODO: could this simply be loaderInstance.context ? */, sendWarning = true) {
  debug('resolve')(`Resolving: ${toRequire.literal}`)
  return new Promise<{resolve: EnhancedResolve.ResolveResult | undefined} & T>((resolve, reject) =>
    loaderInstance.resolve(contextPath, toRequire.literal,
      (err, result, value) => err ? resolve(Object.assign({resolve: value}, toRequire)) || (sendWarning && loaderInstance.emitWarning(err.message)) :
      resolve(Object.assign({resolve: value}, toRequire))
    )
  )
}

export function addBundleLoader<T extends RequireDataBase>(resources: Array<T>, property = 'fallbackLoaders') {
  return resources.map(toRequire => {
    const lazy = toRequire.lazy && 'lazy' || ''
    const chunkName = (toRequire.chunk && `name=${toRequire.chunk}`) || ''
    const and = lazy && chunkName && '&' || ''
    const bundleLoaderPrefix = (lazy || chunkName) ? 'bundle?' : ''
    const bundleLoaderQuery = `${bundleLoaderPrefix}${lazy}${and}${chunkName}`

    return bundleLoaderQuery ? Object.assign({ [property]: [bundleLoaderQuery] }, toRequire) : toRequire
  }) as Array<T & { loaders?: Array<string>, fallbackLoaders?: Array<string> }>
}

// TODO: use custom ModuleDependency instead of injecting code
class SimpleDependencyClass extends ModuleDependency {
  module: Webpack.Core.NormalModule
  type = 'simple-dependency'
  constructor(request: string) {
    super(request)
    debugger
  }
}

class SimpleDependencyTemplate {
  apply(parentDependency: SimpleDependencyClass, source: Webpack.WebpackSources.ReplaceSource, outputOptions: { pathinfo }, requestShortener: { shorten: (request: string) => string }) {
    debugger
    if (outputOptions.pathinfo && parentDependency.module) {
      const comment = ("/*! simple-dependency " + requestShortener.shorten(parentDependency.request) + " */")
      source.insert(source.size(), comment)
    }
  }
}

export const SimpleDependency = Object.assign(SimpleDependencyClass, { Template: SimpleDependencyTemplate })
