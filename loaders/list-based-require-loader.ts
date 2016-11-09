import { RequireData, RequireDataBase, RequireDataBaseResolved, RequireDataBaseMaybeResolved } from './definitions';
import {
  addBundleLoader,
  appendCodeAndCallback,
  expandAllRequiresForGlob,
  getRequireStrings,
  resolveLiteral,
  wrapInRequireInclude
} from './inject-utils';
import * as SourceMap from 'source-map'
import * as loaderUtils from 'loader-utils'
import { concatPromiseResults, getResourcesFromList } from './utils'
import * as path from 'path'
import * as debug from 'debug'
const log = debug('list-based-require-loader')

export interface ListBasedQuery {
  packagePropertyPath: string
  // recursiveProcessing?: boolean | undefined
  // processDependencies?: boolean | undefined
  enableGlobbing?: boolean
  rootDir?: string
}

async function loader (this: Webpack.Core.LoaderContext, source: string, sourceMap?: SourceMap.RawSourceMap) {
  this.async()

  const query = loaderUtils.parseQuery(this.query) as ListBasedQuery

  if (this.cacheable) {
    this.cacheable()
  }

  /**
   * to list all already previously resources, iterate:
   * loader._compilation.modules[0].resource (or userRequest ?)
   * then loader._compilation.modules[0].issuer.resource / userRequest will contain the origin of the addition
   */

  /**
   * 1. resolve SELF to get the package.json contents
   * 2. _.get to the object containing resource info
   * 3. include
   */
  // log(`resourcePath: ${this.resourcePath}`)
  // if (this.resourcePath) {
  //   return this.callback(undefined, source, sourceMap)
  // }
  try {
    const self = await resolveLiteral({ literal: this.resourcePath }, this)
    if (!self.resolve) {
      return this.callback(undefined, source, sourceMap)
    }

    const resolve = self.resolve
    const resources = resolve ?
      getResourcesFromList(resolve.descriptionFileData, query.packagePropertyPath) :
      []

    if (!resources.length) {
      return this.callback(undefined, source, sourceMap)
    }

    // debugger
    // const relativeResource = `./${path.relative(this.context, this.resourcePath)}`
    // const allResources = await getResourcesRecursively(relativeResource /*this.currentRequest*/, this.context, query.packagePropertyPath, this, query.recursiveProcessing)
    // const allResources = await getResourcesRecursively(relativeResource /*this.currentRequest*/, this.context, query.packagePropertyPath, this, query.recursiveProcessing)
    let resourceData = await addBundleLoader(resources, 'loaders')

    const isRootRequest = query.rootDir === resolve.descriptionFileRoot
    log(`resourceData for ${this.resourcePath}`, resourceData.map(r => r.literal))

    if (query.enableGlobbing) {
      resourceData = await expandAllRequiresForGlob(resourceData, this, isRootRequest ? false : resolve.descriptionFileRoot)
    } else {
      resourceData = resourceData.filter(r => !r.literal.includes(`*`))
    }

    const resolvedResources = (await Promise.all(
      resourceData.map(async r => {
        let resource: RequireDataBaseMaybeResolved | null = null
        const packageName = resolve.descriptionFileData && resolve.descriptionFileData.name
        if (packageName && !path.isAbsolute(r.literal) && !isRootRequest) {
          // resolve as MODULE_NAME/REQUEST_PATH
          resource = await resolveLiteral(Object.assign({}, r, { literal: `${packageName}/${r.literal}` }), this, resolve.descriptionFileRoot, false)
        }
        // else {
        //   log(`Would test: ${packageName}/${r.literal}`)
        // }
        if (!resource || !resource.resolve) {
          // resolve as REQUEST_PATH
          resource = await resolveLiteral(r, this, resolve.descriptionFileRoot, false)
        }
        if (!resource.resolve) {
          return this.emitWarning(`Unable to resolve ${r.literal} in context of ${packageName}`)
        }
        return resource as RequireData
      })
    )).filter(r => !!r && r.resolve.path !== this.resourcePath) as Array<RequireData>

    log(`Adding resources to ${this.resourcePath}: ${resolvedResources.map(r => r.literal).join(', ')}`)

    let requireStrings = await getRequireStrings(resolvedResources, undefined, this, true)
    const inject = requireStrings.map(wrapInRequireInclude).join('\n')
    appendCodeAndCallback(this, source, inject, sourceMap)
  } catch (e) {
    debug(e)
    this.emitError(e.message)
    this.callback(undefined, source, sourceMap)
  }
}

module.exports = loader
