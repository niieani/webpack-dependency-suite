import { WebpackLoader, AddLoadersMethod, PathWithLoaders, Resolver, RequireData, RequireDataBase } from './definitions';
import * as path from 'path'
import * as loaderUtils from 'loader-utils'
import * as SourceMap from 'source-map'

export function appendCodeAndCallback(loader: WebpackLoader, source: string, inject: string, sourceMap?: SourceMap.RawSourceMap, synchronousIfPossible = false) {
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

export async function getRequireStrings(maybeResolvedRequires: Array<RequireData | { literal: string, resolve?: undefined }>, addLoadersMethod: AddLoadersMethod | undefined, loaderInstance: WebpackLoader, forceFallbackLoaders = false): Promise<Array<string>> {
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
    pathsAndLoaders = requires.map(r => ({ literal: r.literal, loaders: r.fallbackLoaders || [], path: r.resolve.path }))
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

export function resolveLiteral<T extends { literal: string }>(toRequire: T, loaderInstance: WebpackLoader) {
  const resourceDir = path.dirname(loaderInstance.resourcePath)
  return new Promise<{resolve: Resolver.ResolveResult} & T>((resolve, reject) =>
    loaderInstance.resolve(resourceDir, toRequire.literal,
      (err, result, value) => err ? resolve() || loaderInstance.emitWarning(err.message) :
      resolve(Object.assign({resolve: value}, toRequire))
    )
  )
}

export function addFallbackLoaders(resolvedResources: Array<RequireDataBase>, loaderInstance: WebpackLoader) {
  return resolvedResources.map(toRequire => {
    const lazy = toRequire.lazy && 'lazy' || ''
    const chunkName = (toRequire.chunk && `name=${toRequire.chunk}`) || ''
    const and = lazy && chunkName && '&'
    const bundleLoaderPrefix = (lazy || chunkName) ? 'bundle?' : ''
    const fallbackLoaderQuery = `${bundleLoaderPrefix}${lazy}${and}${chunkName}`

    return fallbackLoaderQuery ? Object.assign({ fallbackLoaders: [fallbackLoaderQuery] }, toRequire) : toRequire
  }) as Array<RequireData>
}
