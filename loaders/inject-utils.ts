import { AddLoadersMethod, PathWithLoaders, RequireData, RequireDataBase } from './definitions'
import * as path from 'path'
import * as loaderUtils from 'loader-utils'
import * as SourceMap from 'source-map'
import ModuleDependency = require('webpack/lib/dependencies/ModuleDependency')

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

export async function getRequireStrings(maybeResolvedRequires: Array<RequireData | { literal: string, resolve?: undefined }>, addLoadersMethod: AddLoadersMethod | undefined, loaderInstance: Webpack.Core.LoaderContext, forceFallbackLoaders = false): Promise<Array<string>> {
  const resourceDir = path.dirname(loaderInstance.resourcePath)

  const requires = await Promise.all(maybeResolvedRequires.map(
    async r => !r.resolve ? await resolveLiteral(r, loaderInstance) : r
  )) as Array<RequireData>

  let pathsAndLoaders: Array<PathWithLoaders & {removed?: boolean}>

  if (typeof addLoadersMethod === 'function') {
    const maybePromise = addLoadersMethod(requires, loaderInstance)
    pathsAndLoaders = (maybePromise as Promise<Array<PathWithLoaders>>).then ? await maybePromise : maybePromise as Array<PathWithLoaders>
    pathsAndLoaders = pathsAndLoaders.map(p => {
      const rq = requires.find(r => r.resolve.path === p.path)
      if (!rq) return Object.assign(p, {removed: true})
      return Object.assign(p, { loaders: (p.loaders && !forceFallbackLoaders) ? p.loaders : (rq.fallbackLoaders || []), literal: rq.literal })
    }).filter(r => !r.removed)
  } else {
    pathsAndLoaders = requires.map(r => ({ literal: r.literal, loaders: r.loaders || r.fallbackLoaders || [], path: r.resolve.path }))
  }

  return pathsAndLoaders.map(p =>
    (p.loaders && p.loaders.length) ?
      (`!${p.loaders.join('!')}!` + (p.literal ? p.literal : `./${path.relative(resourceDir, p.path)}`)) :
      (p.literal ? p.literal : `./${path.relative(resourceDir, p.path)}`)
  )
}

export function wrapInRequireInclude(toRequire: string) {
  return `require.include('${toRequire}');`
}

export function resolveLiteral<T extends { literal: string }>(toRequire: T, loaderInstance: Webpack.Core.LoaderContext) {
  const resourceDir = path.dirname(loaderInstance.resourcePath)
  return new Promise<{resolve: EnhancedResolve.ResolveResult} & T>((resolve, reject) =>
    loaderInstance.resolve(resourceDir, toRequire.literal,
      (err, result, value) => err ? resolve() || loaderInstance.emitWarning(err.message) :
      resolve(Object.assign({resolve: value}, toRequire))
    )
  )
}

export function addBundleLoader(resolvedResources: Array<RequireDataBase>, loaderInstance: Webpack.Core.LoaderContext, property = 'fallbackLoaders') {
  return resolvedResources.map(toRequire => {
    const lazy = toRequire.lazy && 'lazy' || ''
    const chunkName = (toRequire.chunk && `name=${toRequire.chunk}`) || ''
    const and = lazy && chunkName && '&' || ''
    const bundleLoaderPrefix = (lazy || chunkName) ? 'bundle?' : ''
    const bundleLoaderQuery = `${bundleLoaderPrefix}${lazy}${and}${chunkName}`

    return bundleLoaderQuery ? Object.assign({ [property]: [bundleLoaderQuery] }, toRequire) : toRequire
  }) as Array<RequireData>
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
