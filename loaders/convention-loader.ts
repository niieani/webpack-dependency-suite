import { WebpackLoader, CachedInputFileSystem, AddLoadersQuery, PathWithLoaders } from './definitions'
import * as path from 'path'
import * as fs from 'fs'
import * as loaderUtils from 'loader-utils'
import * as SourceMap from 'source-map'
import * as debug from 'debug'
import * as webpack from 'webpack'
import {appendCode, getRequireStrings, resolveLiteral, wrapInRequireInclude} from './inject-utils'
const log = debug('convention-loader')

export type ConventionFunction = (fullPath: string, query?: ConventionQuery, loaderInstance?: WebpackLoader) => string | string[] | Promise<string | string[]>
export type Convention = 'extension-swap' | ConventionFunction

export interface ConventionQuery extends AddLoadersQuery {
  convention: Convention | Array<Convention>
  extension?: string | string[]
  [customSetting: string]: any
}

async function getFilesInDir(directory: string, {
      skipHidden = true, recursive = false, regexFilter = undefined, emitWarning = console.warn.bind(console), emitError = console.error.bind(console), fileSystem = fs
    }: {
      skipHidden?: boolean, returnFullPath?: boolean, recursive?: boolean, regexFilter?: RegExp, emitWarning?: (warn: string) => void, emitError?: (warn: string) => void, fileSystem?: { readdir: Function, stat: Function }
    } = {}
  ): Promise<Array<{ filePath: string, stat: fs.Stats }>> {

  if (!directory) {
    emitError(`No directory supplied`)
    return []
  }

  let files = await new Promise<string[]>((resolve, reject) =>
    fileSystem.readdir(directory, (err, value) => err ? resolve([]) || emitWarning(`Error when trying to load ${directory}: ${err.message}`) : resolve(value)))

  files = files.map(filePath => path.join(directory, filePath))

  let stats = (await Promise.all(
    files
      .map(filePath => new Promise<{ filePath: string, stat: fs.Stats }>((resolve, reject) =>
        fileSystem.stat(filePath, (err, stat) => err ? resolve({filePath, stat}) : resolve({filePath, stat})))
      )
  )).filter(stat => !!stat.stat)

  if (regexFilter || skipHidden) {
    stats = stats
      .filter(file =>
        !(regexFilter && file.stat.isFile() && !file.filePath.match(regexFilter)) &&
        !(skipHidden && path.basename(file.filePath).indexOf('.') === 0)
      )
  }

  if (!recursive)
     return stats.filter(file => file.stat.isFile())

  const subDirectoryStats = await Promise.all(
    stats.filter(file => file.stat.isDirectory()).map(
      file => getFilesInDir(file.filePath, {
        skipHidden, recursive, regexFilter, emitWarning, emitError, fileSystem
      })
    )
  )

  return stats.filter(file => file.stat.isFile()).concat(
    ...subDirectoryStats
  )
}

const conventions: { [convention: string]: ConventionFunction } = {
  'extension-swap'(fullPath: string, query: ConventionQuery) {
    const basename = path.basename(fullPath)
    const noExtension = basename.substr(0, basename.lastIndexOf('.')) || basename
    let extensions: string[]
    if (typeof query.extension !== 'array') {
      extensions = [query.extension || '.html']
    } else {
      extensions = query.extension
    }
    const basepath = path.dirname(fullPath)
    return extensions.map(extension => path.join(basepath, noExtension + extension))
  },

  async 'all-files-matching-regex'(fullPath: string, query: ConventionQuery & {regex: RegExp, directory: string}, loaderInstance: WebpackLoader) {
    const files = await getFilesInDir(query.directory, {
      regexFilter: query.regex,
      emitWarning: loaderInstance.emitWarning.bind(loaderInstance),
      emitError: loaderInstance.emitError.bind(loaderInstance),
      fileSystem: loaderInstance.fs,
      recursive: true
    })

    return files
      .filter(file => file.filePath !== loaderInstance.resourcePath)
      .map(file => file.filePath)
  }
}

async function loader (this: WebpackLoader, source: string, sourceMap?: SourceMap.RawSourceMap) {
  this.async()

  const query = loaderUtils.parseQuery(this.query) as ConventionQuery

  if (this.cacheable) {
    this.cacheable()
  }

  if (!query || !query.convention) {
    this.callback(new Error(`No convention defined`))
    return
  }

  // log(`Convention loading ${path.basename(this.resourcePath)}`)

  let requires: Array<string> = []
  const maybeAddResource = async (input: string | string[] | Promise<string | string[]>) => {
    if (!input) return
    const value = (input as Promise<string | string[]>).then ? await input : input as string | string[]
    const fullPaths = typeof value === 'string' ? [value] : value
    await Promise.all(fullPaths.map(async fullPath => {
      const stat = await new Promise<fs.Stats>((resolve, reject) =>
        this.fs.stat(fullPath, (err, value) => resolve(value)))
      if (stat) {
        requires.push(fullPath)
      }
    }))
  }

  const actOnConvention = async (convention: Convention) => {
    if (typeof convention === 'function') {
      await maybeAddResource(convention(this.resourcePath, query, this))
    } else {
      if (conventions[convention])
        await maybeAddResource(conventions[convention](this.resourcePath, query, this))
      else
        throw new Error(`No default convention named '${convention}' found`)
    }
  }

  if (typeof query.convention !== 'function' && typeof query.convention !== 'string') {
    await Promise.all(query.convention.map(actOnConvention))
  } else {
    await actOnConvention(query.convention)
  }

  const resourceDir = path.dirname(this.resourcePath)
  const relativeRequires = requires.map(r => ({ literal: `./${path.relative(resourceDir, r)}` }))

  if (!relativeRequires.length) {
    this.callback(undefined, source, sourceMap)
    return
  }

  log(`Adding resources to ${this.resourcePath}: ${relativeRequires.map(r => r.literal).join(', ')}`)

  const requireStrings = await getRequireStrings(
    relativeRequires, query.addLoadersCallback, this
  )

  const inject = requireStrings.map(wrapInRequireInclude).join('\n')

  return appendCode(this, source, inject, sourceMap)
}

module.exports = loader;
