import * as SourceMap from 'source-map'
import * as fs from 'fs'

export interface PathWithLoaders {
  path: string
  /**
   * strings of loaders with their queries without the '!'
   * (if want to cancel out all previous loaders, use '!!' at the beginning)
   */
  loaders?: Array<string> | undefined
  literal?: string | undefined
}

export type AddLoadersMethod = (files: Array<RequireData>, loaderInstance?: WebpackLoader) => Array<PathWithLoaders> | Promise<Array<PathWithLoaders>>

export interface RequireData extends RequireDataBase {
  fallbackLoaders?: string[] | undefined
  resolve: Resolver.ResolveResult // | undefined
}

export interface RequireDataBase {
  literal: string,
  lazy: boolean,
  chunk: string | undefined
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


export type LoaderCallback = (error?: Error | undefined | null, code?: string, jsonSourceMap?: SourceMap.RawSourceMap) => void
export interface WebpackLoader {
  fs: typeof fs & CachedInputFileSystem

  _compiler // Compiler
  _compilation
  _module
  version: number
  emitWarning: (warning: string) => void
  emitError: (error: string) => void
  /**
   * Compiles the code and returns its module.exports
   */
  exec: (code: string, filename: string) => any
  resolve: (path: string, request: string, callback: StandardCallbackWithLog<string, Resolver.ResolveResult>) => void
  resolveSync: (path: string, request: string) => void
  sourceMap: boolean
  webpack: boolean
  options // webpack options
  target // options.target
  loadModule: Function
  context: string
  loaderIndex: number
  loaders: Array<Loader>

  /**
   * Full path to the file being loaded
   */
  resourcePath: string
  resourceQuery: string
  /**
   * Mark the Loader as asynchronous (use together with the callback)
   */
  async: () => LoaderCallback
  cacheable: () => void
  callback: LoaderCallback
  addDependency: Function
  dependency: Function
  addContextDependency: Function
  getDependencies: Function
  getContextDependencies: Function
  clearDependencies: Function
  resource
  request
  remainingRequest
  currentRequest
  previousRequest
  query: any
  data
}

export interface CachedInputFileSystem {
  fileSystem: typeof fs
}

export interface Loader {
  path: string
  query: string
  options
  normal: Function // executes loader?
  pitch: Function // executes loader?
  raw
  data
  pitchExecuted: boolean
  normalExecuted: boolean
  request
}

export declare type StandardCallback<T, R> = (err: Error | undefined, result1: T, result2: R) => void
export declare type StandardCallbackWithLog<T, R> = StandardCallback<T, R> & { log?: (info: string) => void }

// declare module 'enhanced-resolve/lib/Resolver' {
export declare module Resolver {
  export interface ResolveContext {
    issuer?: string
  }

  export interface ResolveResult {
    context: ResolveContext
    /**
     * related package.json file
     */
    descriptionFileData: Object
    /**
     * full path to package.json
     */
    descriptionFilePath: string
    /**
     * full path to module root directory
     */
    descriptionFileRoot: string
    file: boolean
    module: boolean
    path: string
    query: string | undefined
    relativePath: string
    request: undefined | any // TODO
  }

  export class Resolver {
    resolve(context: ResolveContext, path: string, request: string, callback: StandardCallbackWithLog<string, ResolveResult>): void
  }
}

// interface Array<T> {
//   filter<U extends T>(pred: (a: T) => a is U): U[];
// }
