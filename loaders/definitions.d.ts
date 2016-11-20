import * as SourceMap from 'source-map'
import * as fs from 'fs'
import * as Webpack from '../custom_typings/webpack'

export interface CommentLoaderOptions extends AddLoadersOptions {
  alwaysUseCommentBundles?: boolean
  enableGlobbing?: boolean
}

export type ConventionFunction = (fullPath: string, query?: ConventionOptions, loaderInstance?: Webpack.Core.LoaderContext) => string | string[] | Promise<string | string[]>
export type Convention = 'extension-swap' | ConventionFunction

export interface ConventionOptions extends AddLoadersOptions {
  convention: Convention | Array<Convention>
  extension?: string | string[]
  [customSetting: string]: any
}

export type SelectorAndAttribute = { selector: string, attribute: string }

export interface HtmlRequireOptions extends AddLoadersOptions {
  selectorsAndAttributes?: Array<SelectorAndAttribute>
  globReplaceRegex?: RegExp | undefined
  enableGlobbing?: boolean
}

export interface ListBasedRequireOptions extends AddLoadersOptions {
  packagePropertyPath: string
  // recursiveProcessing?: boolean | undefined
  // processDependencies?: boolean | undefined
  enableGlobbing?: boolean
  rootDir?: string
  /**
   * Useful setting to true when using linked modules
   */
  fallbackToMainContext?: boolean

  /**
   * only add dependencies to the FIRST file of the given compilation, per each module
   * TODO: add cache for when this is false (otherwise it can get really slow!)
   */
  requireInFirstFileOnly?: boolean
}

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

export interface AddLoadersOptions {
  addLoadersCallback?: AddLoadersMethod
  [customSetting: string]: any
}
