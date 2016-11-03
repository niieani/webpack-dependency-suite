export as namespace EnhancedResolve;
export = EnhancedResolve

declare namespace EnhancedResolve {
  export type ResolveCallback = Webpack.Core.StandardCallbackWithLog<string, ResolveResult> & { missing?: Array<string> }

  export interface ResolveContext {
    issuer?: string
  }

  export interface ResolveResult {
    context: ResolveContext
    /**
     * related package.json file
     */
    descriptionFileData: { [index: string]: any, version: string, name: string, dependencies: {[index:string]: string} }
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
    resolve(context: ResolveContext, path: string, request: string, callback: EnhancedResolve.ResolveCallback): void
    doResolve
    plugin
  }

  export function createInnerCallback<T>(callback: T, options: { log?: (msg:string) => void, stack?: any, missing?: Array<any> }, message?: string | null, messageOptional?: boolean): T & { log: (msg: string) => void, stack: any, missing: Array<any> }
}
