import { AddLoadersQuery, AddLoadersMethod, RequireData } from './definitions'
import * as path from 'path'
import * as loaderUtils from 'loader-utils'
import * as SourceMap from 'source-map'
import * as acorn from 'acorn'
import * as walk from 'acorn/dist/walk'
import * as ESTree from 'estree'
import * as debug from 'debug'
import {appendCodeAndCallback, getRequireStrings, wrapInRequireInclude, resolveLiteral, addBundleLoader, SimpleDependency, expandAllRequiresForGlob} from './inject-utils'

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

export interface CommentLoaderQuery extends AddLoadersQuery {
  alwaysUseCommentBundles?: boolean
  enableGlobbing?: boolean
}

async function loader (this: Webpack.Core.LoaderContext, source: string, sourceMap?: SourceMap.RawSourceMap) {
  const query = loaderUtils.parseQuery(this.query) as CommentLoaderQuery

  if (this.cacheable) {
    this.cacheable()
  }

  this.async()

  // log(`Parsing ${path.basename(this.resourcePath)}`)

  const comments: Array<acorn.Comment> = []
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

  /**
   * @import @lazy @chunk('module') 'something'
   */
  const commentsAndLiterals =
    findLiteralNodesAfterBlockComment(ast as ESTree.Program, comments, /^@import *(@lazy)? *(?:@chunk\(['"`]*([\w-]+)['"`]*\))? *(@lazy)?/)
    .map((cal: { commentMatch: RegExpMatchArray, literal: string }) => ({
      literal: cal.literal,
      lazy: !!(cal.commentMatch[1] || cal.commentMatch[3]),
      chunk: cal.commentMatch[2]
    }))

  /**
   * @import('module') @lazy @chunk('module')
   */
  const commentOnlyImports = comments
    .filter(c => c.type === 'Block')
    .map(c => c.value.trim().match(/^@import\([\'"`]*([- \./\w]+)['"`]\)* *(@lazy)? *(?:@chunk\(['"`]*([\w-]+)['"`]*\))? *(@lazy)?$/))
    .filter(c => !!c)
    .map((c: RegExpMatchArray) => ({
      literal: c[1],
      lazy: !!(c[2] || c[4]),
      chunk: c[3]
    }))

  if (!commentsAndLiterals.length && !commentOnlyImports.length) {
    this.callback(undefined, source, sourceMap)
    return
  }

  const allResources = [...commentsAndLiterals, ...commentOnlyImports]

  try {
    let resourceData = await addBundleLoader(allResources, this)

    if (query.enableGlobbing) {
      resourceData = await expandAllRequiresForGlob(resourceData, this)
    } else {
      resourceData = resourceData.filter(r => !r.literal.includes(`*`))
    }

    log(`Adding resources to ${this.resourcePath}: ${resourceData.map(r => r.literal).join(', ')}`)

    const requireStrings = await getRequireStrings(resourceData, query.addLoadersCallback, this, query.alwaysUseCommentBundles)
    const inject = requireStrings.map(wrapInRequireInclude).join('\n')
    appendCodeAndCallback(this, source, inject, sourceMap)
  } catch (e) {
    debug(e)
    this.emitError(e.message)
    this.callback(undefined, source, sourceMap)
  }
}

module.exports = loader;
