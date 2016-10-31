import { WebpackLoader, AddLoadersQuery, Resolver, AddLoadersMethod, RequireData, RequireDataBase } from './definitions'
import * as path from 'path'
import * as loaderUtils from 'loader-utils'
import * as SourceMap from 'source-map'
import * as cheerio from 'cheerio'
import {addFallbackLoaders, getRequireStrings, wrapInRequireInclude, appendCodeAndCallback} from './inject-utils'
import * as htmlLoader from 'html-loader'
import * as debug from 'debug'
const log = debug('html-require-loader')

async function loader (this: WebpackLoader, pureHtml: string, sourceMap?: SourceMap.RawSourceMap) {
  const query = loaderUtils.parseQuery(this.query) as AddLoadersQuery
  const source = htmlLoader.bind(this)(pureHtml, sourceMap) as string

  const resources = getTemplateResourcesData(pureHtml)
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

export const templateStringRegex = /\${.+?}/g

/**
 * Generates key-value dependency pairs of:
 * - <require from="paths">
 * - view-model="file"
 * - view="file.html"
 */
export function getTemplateResourcesData(html: string, useGlobPaths = false) {
  const $ = cheerio.load(html) // { decodeEntities: false }

  function extractRequire(context: Cheerio, fromAttribute = 'from') {
    const resources: Array<RequireDataBase> = []
    context.each(index => {
      let path: string = context[index].attribs[fromAttribute]
      if (!path) return
      if (templateStringRegex.test(path)) {
        if (!useGlobPaths) return
        path = path.replace(templateStringRegex, `*`)
      }
      const lazy = context[index].attribs.hasOwnProperty('lazy')
      const chunk: string = context[index].attribs['bundle'] || context[index].attribs['chunk']
      resources.push({ literal: path, lazy, chunk })
    })
    return resources
  }

  const resources = [
    // e.g. <require from="./file">
    // e.g. <require from="bootstrap" lazy bundle="vendor">
    ...extractRequire($('require')),
    // e.g. <compose view-model="file">
    ...extractRequire($('[view-model]', 'view-model')),
    // e.g. <compose view-model="file">
    ...extractRequire($('[view]', 'view'))
  ]

  return resources
}

module.exports = loader
