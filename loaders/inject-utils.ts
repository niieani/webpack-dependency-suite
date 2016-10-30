import { WebpackLoader, AddLoadersMethod, PathWithLoaders, Resolver } from './definitions';
import * as path from 'path'
import * as loaderUtils from 'loader-utils'
import * as SourceMap from 'source-map'

export function appendCode(loader: WebpackLoader, source: string, inject: string, sourceMap?: SourceMap.RawSourceMap, synchronousIfPossible = false) {
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

export async function getRequireStrings(requires: Array<string>, addLoadersMethod: AddLoadersMethod | undefined | null, resourceDir: string) {
  if (typeof addLoadersMethod === 'function') {
    const maybePromise = addLoadersMethod(requires)
    const pathsAndLoaders = (maybePromise as Promise<Array<PathWithLoaders>>).then ? await maybePromise : maybePromise as Array<PathWithLoaders>
    return pathsAndLoaders//.map(p => Object.assign())
      .map(p =>
      p.loaders.length ?
        `!${p.loaders.join('!')}!./${path.relative(resourceDir, p.path)}` :
        `./${path.relative(resourceDir, p.path)}`
    )
  } else {
    return requires.map(fullPath => `./${path.relative(resourceDir, fullPath)}`)
  }
}

export interface RequireData {
  fallbackLoaders: string[]
  resolve: Resolver.ResolveResult
  literal: string
}
