import * as SourceMap from 'source-map'
import * as fs from 'fs'
import * as Resolver from '../custom_typings/enhanced-resolve'
import * as Webpack from '../custom_typings/webpack'
// import Resolver = require('enhanced-resolve/lib/Resolver')

export interface PathWithLoaders {
  path: string
  /**
   * strings of loaders with their queries without the '!'
   * (if want to cancel out all previous loaders, use '!!' at the beginning)
   */
  loaders?: Array<string> | undefined
  literal?: string | undefined
}

export type AddLoadersMethod = (files: Array<RequireData>, loaderInstance?: Webpack.Core.LoaderContext) => Array<PathWithLoaders> | Promise<Array<PathWithLoaders>>

export interface RequireData extends RequireDataBase {
  loaders?: Array<string> | undefined
  fallbackLoaders?: Array<string> | undefined
  resolve: Resolver.ResolveResult // | undefined
}

export interface RequireDataBase {
  literal: string
  lazy: boolean
  chunk?: string
}

export interface AddLoadersQuery {
  addLoadersCallback?: AddLoadersMethod
  [customSetting: string]: any
}

/**
 * WEBPACK
 *
 * @export
 * @interface WebpackLoader
 */


// interface Array<T> {
//   filter<U extends T>(pred: (a: T) => a is U): U[];
// }
