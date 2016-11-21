import {
  AddLoadersOptions,
  RequireData,
  RequireDataBase,
  RequireDataBaseMaybeResolved,
  RequireDataBaseResolved,
  ListBasedRequireOptions
} from '../typings/definitions'
import {
  addBundleLoader,
  appendCodeAndCallback,
  expandAllRequiresForGlob,
  getRequireStrings,
  resolveLiteral,
  wrapInRequireInclude
} from '../utils/inject'
import * as SourceMap from 'source-map'
import * as loaderUtils from 'loader-utils'
import { concatPromiseResults, getResourcesFromList } from '../utils'
import * as path from 'path'
import * as debug from 'debug'
const log = debug('list-based-require-loader')

export default async function ListBasedRequireLoader (this: Webpack.Core.LoaderContext, source: string, sourceMap?: SourceMap.RawSourceMap) {
  this.async()

  // add defaults:
  const query = Object.assign({ requireInFirstFileOnly: true, enableGlobbing: false }, loaderUtils.parseQuery(this.query)) as ListBasedRequireOptions

  if (this.cacheable) {
    this.cacheable()
  }

  /**
   * 1. resolve SELF to get the package.json contents
   * 2. _.get to the object containing resource info
   * 3. include
   */
  try {
    const self = await resolveLiteral({ literal: this.resourcePath }, this)
    const resolve = self.resolve

    // only do require.include in the FIRST file that comes along, when that option is enabled
    const listBasedRequireDone: Set<string> = this._compilation.listBasedRequireDone || (this._compilation.listBasedRequireDone = new Set<string>())
    if (!resolve || (query.requireInFirstFileOnly && listBasedRequireDone.has(resolve.descriptionFileRoot))) {
      return this.callback(undefined, source, sourceMap)
    } else if (query.requireInFirstFileOnly) {
      listBasedRequireDone.add(resolve.descriptionFileRoot)
    }

    const resources = resolve ?
      getResourcesFromList(resolve.descriptionFileData, query.packagePropertyPath) :
      []

    if (!resources.length) {
      return this.callback(undefined, source, sourceMap)
    }

    let resourceData = await addBundleLoader(resources, 'loaders')

    const isRootRequest = query.rootDir === resolve.descriptionFileRoot

    if (query.enableGlobbing) {
      resourceData = await expandAllRequiresForGlob(resourceData, this, isRootRequest ? false : resolve.descriptionFileRoot)
    } else {
      resourceData = resourceData.filter(r => !r.literal.includes(`*`))
    }

    // log(`resourceData for ${this.resourcePath}`, resourceData.map(r => r.literal))

    const resolvedResources = (await Promise.all(
      resourceData.map(async r => {
        let resource: RequireDataBaseMaybeResolved | null = null
        const packageName = resolve.descriptionFileData && resolve.descriptionFileData.name
        const tryContexts = [resolve.descriptionFileRoot, ...(query.fallbackToMainContext ? [query.rootDir] : [])]
        let contextDir: string | undefined
        let tryCount = 0
        const isSameModuleRequest = packageName && (r.literal.startsWith(`${packageName}/`) || r.literal === packageName)

        while ((!resource || !resource.resolve) && (contextDir = tryContexts.shift())) {
          if (!isSameModuleRequest && packageName && !path.isAbsolute(r.literal) && !isRootRequest) {
            const literal = `${packageName}/${r.literal}`
            // resolve as MODULE_NAME/REQUEST_PATH
            resource = await resolveLiteral(Object.assign({}, r, { literal }), this, contextDir, false)
            log(`[${resource && resource.resolve ? 'SUCCESS' : 'FAIL'}] [${++tryCount}] '${literal}' in '${contextDir}'`)
          }
          if (!resource || !resource.resolve) {
            // resolve as REQUEST_PATH
            resource = await resolveLiteral(r, this, contextDir, false) as RequireDataBaseMaybeResolved
            log(`[${resource && resource.resolve ? 'SUCCESS' : 'FAIL'}] [${++tryCount}] '${r.literal}' in '${contextDir}'`)
          }
        }
        if (!resource || !resource.resolve) {
          return this.emitWarning(`Unable to resolve ${r.literal} in context of ${packageName}`)
        }

        if (!resource.literal.startsWith('.') && (resource.resolve.descriptionFileData && resource.resolve.descriptionFileData.name) === packageName) {
          // we're dealing with a request from within the same package
          // let's make sure its relative:
          let relativeLiteral = path.relative(path.dirname(resolve.path), resource.resolve.path)
          if (!relativeLiteral.startsWith('..')) {
            relativeLiteral = `./${relativeLiteral}`
          }
          log(`Mapped an internal module-based literal to a relative one: ${resource.literal} => ${relativeLiteral}`)
          resource.literal = relativeLiteral
        }
        return resource as RequireData
      })
    )).filter(r => !!r && r.resolve.path !== this.resourcePath) as Array<RequireData>

    log(`Adding resources to ${this.resourcePath}: ${resolvedResources.map(r => r.literal).join(', ')}`)

    let requireStrings = await getRequireStrings(resolvedResources, query.addLoadersCallback, this)
    const inject = requireStrings.map(wrapInRequireInclude).join('\n')
    appendCodeAndCallback(this, source, inject, sourceMap)
  } catch (e) {
    log(e)
    this.emitError(e.message)
    this.callback(undefined, source, sourceMap)
  }
}
