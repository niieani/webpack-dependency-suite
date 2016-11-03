import { AddLoadersMethod, PathWithLoaders, RequireData, RequireDataBase } from './definitions'
import * as path from 'path'
import * as loaderUtils from 'loader-utils'
import * as SourceMap from 'source-map'
import { getFilesInDir, concatPromiseResults, cacheInvalidationDebounce } from './utils'
import ModuleDependency = require('webpack/lib/dependencies/ModuleDependency')
import escapeStringForRegex = require('escape-string-regexp')
import {memoize} from 'lodash'
import * as debug from 'debug'

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

export async function expandGlobBase(literal: string, loaderInstance: Webpack.Core.LoaderContext) {
  const pathBits = literal.split(`/`)
  const literalIsRelative = literal[0] === '.'
  let possibleRoots = loaderInstance.options.resolve.modules.filter((m: string) => m !== 'node_modules' /* && m[0] !== '/' -- *nix only */) as Array<string>

  if (!literalIsRelative) {
    const moduleName = pathBits[0].startsWith(`@`) ? pathBits.slice(0, 2).join(`/`) : pathBits[0]
    if (!moduleName.includes(`*`)) {
      const resolved = await resolveLiteral(Object.assign({ literal: moduleName }), loaderInstance, undefined, false /* do not emit warnings for bad resolves here */)
      const root = resolved.resolve && resolved.resolve.descriptionFileRoot
      if (root) {
        possibleRoots = [root]
      }
    }
  } else {
    const nextGlobAtIndex = pathBits.findIndex(pb => pb.includes(`*`))
    const relativePathUntilFirstGlob = pathBits.slice(0, nextGlobAtIndex).join(`/`)
    possibleRoots = [path.join(path.dirname(loaderInstance.resourcePath), relativePathUntilFirstGlob)]
  }

  const possiblePaths = await concatPromiseResults(
    possibleRoots.map(async directory => await getFilesInDir(directory, {
      recursive: true, emitWarning: loaderInstance.emitWarning, emitError: loaderInstance.emitError,
      fileSystem: loaderInstance.fs, skipHidden: true
    }))
  )

  let nonRelativePath = path.join(literal) // removes ./ or from the path
  while (nonRelativePath.startsWith('../')) {
    nonRelativePath = nonRelativePath.slice(3)
  }
  // test case: escape('werwer/**/werwer/*.html').replace(/\//g, '[\\/]+').replace(/\\\*\\\*/g, '\.*?').replace(/\\\*/g, '[^/\\\\]*?')
  const globRegexString = escapeStringForRegex(nonRelativePath)
    .replace(/\//g, '[\\/]+') // accept Windows and Unix slashes
    .replace(/\\\*\\\*/g, '\.*?') // multi glob * => any number of subdirectories
    .replace(/\\\*/g, '[^/\\\\]*?') // single glob * => one directory (stops at first slash/backslash)
  const globRegex = new RegExp(globRegexString)
  const correctPaths = possiblePaths.filter(p => p.stat.isFile() && globRegex.test(p.filePath))
  // return correctPaths
  // return correctPaths.map(p => ({ literal: p.filePath }))
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

const expandGlob = memoize(expandGlobBase, (literal: string, loaderInstance: Webpack.Core.LoaderContext) => {
  /** valid for 10 seconds for the same literal and resoucePath */
  const cacheKey = `${literal}::${path.dirname(loaderInstance.resourcePath)}`
  // invalidate every 10 seconds based on each unique Webpack compilation
  cacheInvalidationDebounce(cacheKey, expandGlob.cache, loaderInstance._compilation)
  return cacheKey
})

export async function expandAllRequiresForGlob<T extends { literal: string }>(requires: Array<T>, loaderInstance: Webpack.Core.LoaderContext) {
  const needDeglobbing = requires.filter(r => r.literal.includes(`*`))
  const deglobbed = requires.filter(r => !r.literal.includes(`*`))
  return deglobbed.concat(await concatPromiseResults(needDeglobbing.map(async r =>
    (await expandGlob(r.literal, loaderInstance))
      .map(correctPath => Object.assign({}, r, { literal: `./${path.relative(path.dirname(loaderInstance.resourcePath), correctPath)}` }))
  )))
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

export function addBundleLoader<T extends RequireDataBase>(resources: Array<T>, loaderInstance: Webpack.Core.LoaderContext, property = 'fallbackLoaders') {
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
