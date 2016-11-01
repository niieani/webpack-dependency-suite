import { AddLoadersQuery, AddLoadersMethod, RequireData, RequireDataBase } from './definitions'
import * as path from 'path'
import * as loaderUtils from 'loader-utils'
import * as SourceMap from 'source-map'
import * as cheerio from 'cheerio'
import {addFallbackLoaders, getRequireStrings, wrapInRequireInclude, appendCodeAndCallback, SimpleDependency} from './inject-utils'
import * as htmlLoader from 'html-loader'
import * as debug from 'debug'
const log = debug('html-require-loader')

export type SelectorAndAttribute = { selector: string, attribute: string }

export interface HtmlRequireQuery extends AddLoadersQuery {
  selectorsAndAttributes: Array<SelectorAndAttribute>
  globReplaceRegex?: RegExp | undefined
}

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
  globReplaceRegex: /\${.+?}/g
} as HtmlRequireQuery

async function loader (this: Webpack.Core.LoaderContext, pureHtml: string, sourceMap?: SourceMap.RawSourceMap) {
  const query = Object.assign({}, defaults, loaderUtils.parseQuery(this.query)) as HtmlRequireQuery
  const source = htmlLoader.bind(this)(pureHtml, sourceMap) as string

  const resources = getTemplateResourcesData(pureHtml, query.selectorsAndAttributes, query.globReplaceRegex)
  if (!resources.length) {
    return source
  }

  const resourceData = await addFallbackLoaders(resources, this)
  log(`Adding resources to ${this.resourcePath}: ${resourceData.map(r => r.literal).join(', ')}`)

  const requireStrings = await getRequireStrings(
    resourceData, query.addLoadersCallback, this
  )

  const inject = requireStrings.map(wrapInRequireInclude).join('\n')
  return appendCodeAndCallback(this, source, inject, sourceMap, true)
}

/**
 * Generates list of dependencies based on the passed in selectors, e.g.:
 * - <require from="paths">
 * - <template view-model="./file"></template>
 * - <template view="file.html"></template>
 */
export function getTemplateResourcesData(html: string, selectorsAndAttributes: Array<SelectorAndAttribute>, globRegex: RegExp | undefined) {
  const $ = cheerio.load(html) // { decodeEntities: false }

  function extractRequire(context: Cheerio, fromAttribute = 'from') {
    const resources: Array<RequireDataBase> = []
    context.each(index => {
      let path: string = context[index].attribs[fromAttribute]
      if (!path) return
      if (globRegex && globRegex.test(path)) {
        path = path.replace(globRegex, `*`)
      }
      const lazy = context[index].attribs.hasOwnProperty('lazy')
      const chunk: string = context[index].attribs['bundle'] || context[index].attribs['chunk']
      resources.push({ literal: path, lazy, chunk })
    })
    return resources
  }

  const resourcesArray = selectorsAndAttributes
    .map(saa => extractRequire($(saa.selector), saa.attribute))

  const resources = ([] as RequireDataBase[]).concat(...resourcesArray)
  return resources
}

module.exports = loader
