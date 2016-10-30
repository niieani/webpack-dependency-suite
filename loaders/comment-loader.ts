import { WebpackLoader, AddLoadersQuery, Resolver, AddLoadersMethod, RequireData } from './definitions'
import * as path from 'path'
import * as loaderUtils from 'loader-utils'
import * as SourceMap from 'source-map'
import * as acorn from 'acorn'
import * as walk from 'acorn/dist/walk'
import * as ESTree from 'estree'
import * as debug from 'debug'
import {appendCode, getRequireStrings, wrapInRequireInclude} from './inject-utils'

const log = debug('comment-loader')

function findLiteralNodesAfterBlockComment(ast: ESTree.Program, comments: Array<acorn.Comment>, commentRegex: RegExp) {
  return comments
    .filter(comment => comment.type === 'Block')
    .map(commentAst => {
      let value = commentAst.value.trim()
      let match = value.match(commentRegex)
      return { ast: commentAst, match }
    })
    .filter(commentMatch => !!commentMatch.match)
    .map(comment => {
      const result = walk.findNodeAfter(ast, comment.ast.end)
      return {
        commentMatch: comment.match,
        literal: result.node && result.node.type === 'Literal' && typeof result.node.value === 'string' ? result.node.value : ''
      }
    })
    .filter(comment => !!comment.literal)
}

async function loader (this: WebpackLoader, source: string, sourceMap?: SourceMap.RawSourceMap) {
  const query = loaderUtils.parseQuery(this.query) as {
    addLoadersCallback?: AddLoadersMethod | undefined
    alwaysUseCommentBundles?: boolean | undefined
  }

  if (this.cacheable) {
    this.cacheable()
  }

  this.async()

  // log(`Parsing ${path.basename(this.resourcePath)}`)

  const comments = []
	let ast: ESTree.Program | undefined = undefined

  const POSSIBLE_AST_OPTIONS = [{
    ranges: true,
    locations: true,
    ecmaVersion: 6,
    sourceType: 'module',
    onComment: comments
  }, {
    ranges: true,
    locations: true,
    ecmaVersion: 6,
    sourceType: 'script',
    onComment: comments
  }] as Array<acorn.Options>

  let i = POSSIBLE_AST_OPTIONS.length
  while (!ast && i--) {
    try {
      comments.length = 0
      ast = acorn.parse(source, POSSIBLE_AST_OPTIONS[i]);
    } catch(e) {
      // ignore the error
      if (!i) {
        throw e
      }
    }
  }

  const commentsAndLiterals = findLiteralNodesAfterBlockComment(ast as ESTree.Program, comments, /^@import *(@lazy)? *(?:@chunk: +([\w-]+))? *(@lazy)?/)

  if (!commentsAndLiterals.length) {
    this.callback(undefined, source, sourceMap)
    return
  }

  const resourceDir = path.dirname(this.resourcePath)
  const resolvedResources = await Promise.all(commentsAndLiterals.map(toRequire =>
    new Promise<{resolve: Resolver.ResolveResult} & typeof toRequire>((resolve, reject) =>
      this.resolve(resourceDir, toRequire.literal,
        (err, result, value) => err ? resolve() || this.emitWarning(err.message) :
        resolve(Object.assign({resolve: value}, toRequire))
      )
    )
  ))

  const resourceData = resolvedResources.filter(r => !!r).map(toRequire => {
    if (!toRequire.commentMatch) return toRequire // NOTE: until fixed https://github.com/Microsoft/TypeScript/issues/7657
    const lazy = (toRequire.commentMatch[1] || toRequire.commentMatch[3] && 'lazy') || ''
    const chunkName = (toRequire.commentMatch[2] && `name=${toRequire.commentMatch[2]}`) || ''
    const and = lazy && chunkName && '&'
    const bundleLoaderPrefix = (lazy || chunkName) ? 'bundle?' : ''
    const fallbackLoaderQuery = `${bundleLoaderPrefix}${lazy}${and}${chunkName}`

    return Object.assign({ fallbackLoaders: [fallbackLoaderQuery] }, toRequire)
  }) as Array<RequireData>

  log(`Adding resources to ${this.resourcePath}: ${resourceData.map(r => r.literal).join(', ')}`)

  const requireStrings = await getRequireStrings(resourceData, query.addLoadersCallback, this, query.alwaysUseCommentBundles)
  const inject = requireStrings.map(wrapInRequireInclude).join('\n')

  appendCode(this, source, inject, sourceMap)
}

module.exports = loader;
