import { SelectorAndAttribute, HtmlRequireOptions, RequireDataBase } from './definitions'
import * as path from 'path'
import * as loaderUtils from 'loader-utils'
import * as SourceMap from 'source-map'
import {addBundleLoader, getRequireStrings, wrapInRequireInclude, appendCodeAndCallback, SimpleDependency, expandAllRequiresForGlob} from '../utils/inject'
import {getTemplateResourcesData} from '../utils'
import * as htmlLoader from 'html-loader'
import * as debug from 'debug'
const log = debug('html-require-loader')

const defaults = {
  selectorsAndAttributes: [
    // e.g. <require from="./file">
    // e.g. <require from="bootstrap" lazy bundle="vendor">
    { selector: 'require', attribute: 'from' },
    // e.g. <compose view-model="file">
    { selector: '[view-model]', attribute: 'view-model' },
    // e.g. <compose view="file">
    { selector: '[view]', attribute: 'view' },
  ],
  // by default glob template string: e.g. '${anything}'
  globReplaceRegex: /\${.+?}/g,
  enableGlobbing: true
} as HtmlRequireOptions

function loader (this: Webpack.Core.LoaderContext, pureHtml: string, sourceMap?: SourceMap.RawSourceMap) {
  if (this.cacheable) {
    this.cacheable()
  }
  const query = Object.assign({}, defaults, loaderUtils.parseQuery(this.query)) as HtmlRequireOptions & {selectorsAndAttributes: Array<SelectorAndAttribute>}
  const source = htmlLoader.bind(this)(pureHtml, sourceMap) as string

  try {
    const resources = getTemplateResourcesData(pureHtml, query.selectorsAndAttributes, query.globReplaceRegex)
    if (!resources.length) {
      return source
    }

    return (async () => {
      this.async()
      let resourceData = await addBundleLoader(resources)
      log(`Adding resources to ${this.resourcePath}: ${resourceData.map(r => r.literal).join(', ')}`)

      if (query.enableGlobbing) {
        resourceData = await expandAllRequiresForGlob(resourceData, this)
      } else {
        resourceData = resourceData.filter(r => !r.literal.includes(`*`))
      }

      const requireStrings = await getRequireStrings(
        resourceData, query.addLoadersCallback, this
      )

      const inject = requireStrings.map(wrapInRequireInclude).join('\n')
      return appendCodeAndCallback(this, source, inject, sourceMap)
    })().catch(e => {
      log(e)
      this.emitError(e.message)
      return this.callback(undefined, source, sourceMap)
    })
  } catch (e) {
    log(e)
    this.emitError(e.message)
    return source
  }
}

module.exports = loader
