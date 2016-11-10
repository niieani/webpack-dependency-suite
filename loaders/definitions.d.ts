import * as SourceMap from 'source-map'
import * as fs from 'fs'
import * as Webpack from '../custom_typings/webpack'

export interface PathWithLoaders {
  path: string
  /**
   * strings of loaders with their queries without the '!'
   * (if want to cancel out all previous loaders, use '!!' at the beginning)
   */
  loaders?: Array<string> | undefined
}

export type AddLoadersMethod = (files: Array<RequireData>, loaderInstance?: Webpack.Core.LoaderContext) => Array<PathWithLoaders> | Promise<Array<PathWithLoaders>>

export interface RequireData extends RequireDataBaseResolved {
  loaders?: Array<string> | undefined
  fallbackLoaders?: Array<string> | undefined
}
export interface RequireDataBaseResolved extends RequireDataBase {
  resolve: EnhancedResolve.ResolveResult
}
export interface RequireDataBaseMaybeResolved extends RequireDataBase {
  resolve: EnhancedResolve.ResolveResult | undefined
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
