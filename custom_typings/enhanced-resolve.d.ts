export as namespace EnhancedResolve;
export = EnhancedResolve

declare namespace EnhancedResolve {
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

declare module 'enhanced-resolve/lib/Resolver' {
  export = EnhancedResolve.Resolver
}
