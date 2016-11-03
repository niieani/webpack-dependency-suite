import * as fs from 'fs'
import * as Resolver from './enhanced-resolve'
import * as SourceMap from 'source-map'

export as namespace Webpack;
export = Webpack
declare namespace Webpack {
  export namespace Core {
    export class ModuleDependency {//extends Module {
      constructor(request: string)
      request: string
      userRequest: string
      isEqualResource(otherResource: ModuleDependency)
    }

    export class Module {
      constructor(request: string)
      module: NormalModule | null
    }

    export class SingleEntryDependency {
      module: NormalModule;
      request: string;
      userRequest: string;
      loc: string;
    }

    export class NormalModule extends MultiModule {
      request: string;
      userRequest: string;
      rawRequest: string;
      parser: Parser;
      resource: string;
      loaders: Loader[];
      fileDependencies: any[];
      contextDependencies: any[];
      error?: any;
      _source?: any;
      assets: Asset;
      _cachedSource?: any;
      optional: boolean;
      building: any[];
      buildTimestamp: number;
    }

    export class MultiModule {
      dependencies: SingleEntryDependency[];
      blocks: any[];
      variables: any[];
      context: string;
      reasons: ModuleReason[];
      debugId: number;
      lastId: number;
      id?: any;
      index?: any;
      index2?: any;
      used?: any;
      usedExports?: any;
      providedExports?: any;
      chunks: any[];
      warnings: any[];
      dependenciesWarnings: any[];
      errors: any[];
      dependenciesErrors: any[];
      strict: boolean;
      meta: Object;
      name: string;
      built: boolean;
      cacheable: boolean;
      issuer?: MultiModule | null;
    }

    export interface ModuleReason {
      module: MultiModule;
      dependency: string;
    }

    export interface ParserPlugins {
      'evaluate Literal': any[];
      'evaluate LogicalExpression': any[];
      'evaluate BinaryExpression': any[];
      'evaluate UnaryExpression': any[];
      'evaluate typeof undefined': any[];
      'evaluate Identifier': any[];
      'evaluate MemberExpression': any[];
      'evaluate CallExpression': any[];
      'evaluate CallExpression .replace': any[];
      'evaluate CallExpression .substr': any[];
      'evaluate CallExpression .substring': any[];
      'evaluate CallExpression .split': any[];
      'evaluate ConditionalExpression': any[];
      'evaluate ArrayExpression': any[];
      'expression process': any[];
      'expression global': any[];
      'expression Buffer': any[];
      'expression setImmediate': any[];
      'expression clearImmediate': any[];
      'call require': any[];
      'expression __filename': any[];
      'evaluate Identifier __filename': any[];
      'expression __dirname': any[];
      'evaluate Identifier __dirname': any[];
      'expression require.main': any[];
      'expression require.extensions': any[];
      'expression module.loaded': any[];
      'expression module.id': any[];
      'expression module.exports': any[];
      'evaluate Identifier module.hot': any[];
      'expression module': any[];
      'call require.config': any[];
      'call requirejs.config': any[];
      'expression require.version': any[];
      'expression requirejs.onError': any[];
      'expression __webpack_require__': any[];
      'evaluate typeof __webpack_require__': any[];
      'expression __webpack_public_path__': any[];
      'evaluate typeof __webpack_public_path__': any[];
      'expression __webpack_modules__': any[];
      'evaluate typeof __webpack_modules__': any[];
      'expression __webpack_chunk_load__': any[];
      'evaluate typeof __webpack_chunk_load__': any[];
      'expression __non_webpack_require__': any[];
      'evaluate typeof __non_webpack_require__': any[];
      'expression require.onError': any[];
      'evaluate typeof require.onError': any[];
      'statement if': any[];
      'expression ?:': any[];
      'evaluate Identifier __resourceQuery': any[];
      'expression __resourceQuery': any[];
      'program': any[];
      'call require.include': any[];
      'evaluate typeof require.include': any[];
      'typeof require.include': any[];
      'call require.ensure': any[];
      'evaluate typeof require.ensure': any[];
      'typeof require.ensure': any[];
      'call require.context': any[];
      'call require:amd:array': any[];
      'call require:amd:item': any[];
      'call require:amd:context': any[];
      'call define': any[];
      'call define:amd:array': any[];
      'call define:amd:item': any[];
      'call define:amd:context': any[];
      'expression require.amd': any[];
      'expression define.amd': any[];
      'expression define': any[];
      'expression __webpack_amd_options__': any[];
      'evaluate typeof define.amd': any[];
      'evaluate typeof require.amd': any[];
      'evaluate Identifier define.amd': any[];
      'evaluate Identifier require.amd': any[];
      'evaluate typeof define': any[];
      'typeof define': any[];
      'can-rename define': any[];
      'rename define': any[];
      'evaluate typeof require': any[];
      'typeof require': any[];
      'evaluate typeof require.resolve': any[];
      'typeof require.resolve': any[];
      'evaluate typeof require.resolveWeak': any[];
      'typeof require.resolveWeak': any[];
      'evaluate typeof module': any[];
      'assign require': any[];
      'can-rename require': any[];
      'rename require': any[];
      'typeof module': any[];
      'evaluate typeof exports': any[];
      'expression require.cache': any[];
      'expression require': any[];
      'call require:commonjs:item': any[];
      'call require:commonjs:context': any[];
      'call require.resolve': any[];
      'call require.resolve(Weak)': any[];
      'call require.resolve(Weak):item': any[];
      'call require.resolve(Weak):context': any[];
      'import': any[];
      'import specifier': any[];
      'expression imported var.*': any[];
      'call imported var': any[];
      'hot accept callback': any[];
      'hot accept without callback': any[];
      'export': any[];
      'export import': any[];
      'export expression': any[];
      'export declaration': any[];
      'export specifier': any[];
      'export import specifier': any[];
      'evaluate typeof System': any[];
      'typeof System': any[];
      'evaluate typeof System.import': any[];
      'typeof System.import': any[];
      'evaluate typeof System.set': any[];
      'expression System.set': any[];
      'evaluate typeof System.get': any[];
      'expression System.get': any[];
      'evaluate typeof System.register': any[];
      'expression System.register': any[];
      'expression System': any[];
      'call System.import': any[];
    }

    export interface Parser {
      _plugins: ParserPlugins;
    }

    export interface Loader {
      /**
       * contents of 'query' object passed in the webpack config
       */
      options: any;
      loader: string;
    }

    export interface Asset {}

    export type LoaderCallback = (error?: Error | undefined | null, code?: string, jsonSourceMap?: SourceMap.RawSourceMap) => void
    export interface LoaderContext {
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
      resolve: (path: string, request: string, callback: EnhancedResolve.ResolveCallback) => void
      resolveSync: (path: string, request: string) => void
      sourceMap: boolean
      webpack: boolean
      options // webpack options
      target // options.target
      loadModule: Function
      context: string
      loaderIndex: number
      loaders: Array<LoaderInfo>

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
      data: null | any
    }

    export interface CachedInputFileSystem {
      fileSystem: typeof fs
    }

    export interface LoaderInfo {
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

    export type StandardCallback<T, R> = (err: Error | undefined, result1: T, result2: R) => void
    export type StandardCallbackWithLog<T, R> = StandardCallback<T, R> & { log?: (info: string) => void }
  }

  export namespace WebpackSources {
    export class ReplaceSource extends Source {
      constructor(source, name)
      insert(pos, newValue)
      listMap(options)
      map(options)
      node: (options)=>any
      replace(start, end, newValue)
      source: (options)=>string
      sourceAndMap(options)
    }
    class Source {
      listNode: any|null
      map(options)
      node: any|null
      size()
      source: any|null
      sourceAndMap(options)
      updateHash(hash)
    }
  }
}
