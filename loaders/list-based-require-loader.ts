import { Z_MEM_ERROR } from 'zlib';
import { AddLoadersQuery, AddLoadersMethod, RequireData, RequireDataBase, PathWithLoaders } from './definitions'
import * as path from 'path'
import * as loaderUtils from 'loader-utils'
import * as SourceMap from 'source-map'
import {addBundleLoader, getRequireStrings, wrapInRequireInclude, appendCodeAndCallback} from './inject-utils'
import {get} from 'lodash'
import * as debug from 'debug'
const log = debug('list-based-require-loader')

export interface ListBasedQuery {
  packagePropertyPath: string
  processDependencies?: boolean | undefined
}

interface ResourcesInput {
  path: Array<string> | string
  lazy?: boolean
  bundle?: string
  chunk?: string
}
interface Resources {
  literal: string
  lazy: boolean
  chunk?: string
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
   * steps:
   * 1. resolve SELF to get the package.json contents
   * 2. _.get to the object containing resource info
   * 3. include
   */
  const resolve = await new Promise<EnhancedResolve.ResolveResult>((resolve, reject) =>
    this.resolve(this.context, this.currentRequest, (err, result, value) => err ? resolve() || this.emitWarning(`Error resolving: ${this.currentRequest}`) : resolve(value)));

  const resources = get(resolve.descriptionFileData, query.packagePropertyPath, [] as Array<ResourcesInput | string>)

  const allResources = [] as Array<Resources>

  // if (packageJson.aurelia && packageJson.aurelia.build && packageJson.aurelia.build.resources) {}
  resources.forEach(input => {
    const r = input instanceof Object && !Array.isArray(input) ? input as ResourcesInput : { path: input }
    const paths = Array.isArray(r.path) ? r.path : [r.path]
    paths.forEach(
      literal => allResources.push({ literal, lazy: r.lazy || false, chunk: r.bundle || r.chunk })
    )
  })

  const resourceData = await addBundleLoader(allResources, this)

  log(`Adding resources to ${this.resourcePath}: ${resourceData.map(r => r.literal).join(', ')}`)

  const requireStrings = await getRequireStrings(resourceData, undefined, this, true)

  const inject = requireStrings.map(wrapInRequireInclude).join('\n')
  appendCodeAndCallback(this, source, inject, sourceMap)
}

async function addLoadersMethod(files: Array<RequireData>, loaderInstance: Webpack.Core.LoaderContext): Promise<Array<PathWithLoaders>> {
  // files[0].
}

module.exports = loader
