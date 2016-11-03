declare module 'acorn/dist/walk' {
  import * as ESTree from 'estree'
  export function findNodeAfter(program: ESTree.Program, after: number): {node: ESTree.Node}
}
declare module 'loader-utils' {
  export function parseQuery(query: any): any
  export function getCurrentRequest(webpackLoader)
}
declare module 'html-loader'

declare module 'enhanced-resolve/lib/getInnerRequest'
