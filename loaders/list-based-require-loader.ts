import {
  addBundleLoader,
  appendCodeAndCallback,
  expandAllRequiresForGlob,
  getRequireStrings,
  splitRequest,
  wrapInRequireInclude
} from './inject-utils';
import * as SourceMap from 'source-map'
import * as loaderUtils from 'loader-utils'
import { concatPromiseResults, getResourcesFromList, getResourcesRecursively } from './utils';
import * as debug from 'debug'
const log = debug('list-based-require-loader')

export interface ListBasedQuery {
  packagePropertyPath: string
  recursiveProcessing?: boolean | undefined
  processDependencies?: boolean | undefined
  enableGlobbing?: boolean
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
  try {
    const allResources = await getResourcesRecursively(this.currentRequest, this.context, query.packagePropertyPath, query.recursiveProcessing, query.processDependencies)
    // const resolve = await new Promise<EnhancedResolve.ResolveResult>((resolve, reject) =>
    //   this.resolve(this.context, this.currentRequest, (err, result, value) => err ? resolve() || this.emitWarning(`Error resolving: ${this.currentRequest}`) : resolve(value)));

    // let allResources = getResourcesFromList(resolve.descriptionFileData, query.packagePropertyPath)

    // if (query.processDependencies) {
    //   allResources.map(r => splitRequest(r.literal)).map(async r => {
    //     const resolved = await new Promise<EnhancedResolve.ResolveResult>((resolve, reject) =>
    //       this.resolve(this.context, r.moduleName, (err, result, value) => err ? resolve() : resolve(value)));
    //     if (resolved && resolved.descriptionFileRoot !== resolve.descriptionFileRoot) {
    //       return getResourcesFromList(resolved.descriptionFileData, query.packagePropertyPath)
    //     } else {
    //       return []
    //     }
    //   })
    // }

    let resourceData = await addBundleLoader(allResources, this, 'loaders')

    if (query.enableGlobbing) {
      resourceData = await expandAllRequiresForGlob(resourceData, this)
    } else {
      resourceData = resourceData.filter(r => !r.literal.includes(`*`))
    }

    log(`Adding resources to ${this.resourcePath}: ${resourceData.map(r => r.literal).join(', ')}`)

    const requireStrings = await getRequireStrings(resourceData, undefined, this, true)
    const inject = requireStrings.map(wrapInRequireInclude).join('\n')
    appendCodeAndCallback(this, source, inject, sourceMap)
  } catch (e) {
    debug(e)
    this.emitError(e.message)
    this.callback(undefined, source, sourceMap)
  }
}

module.exports = loader
