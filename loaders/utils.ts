import * as path from 'path'
import * as fs from 'fs'
import {memoize, MapCache} from 'lodash'
import { AddLoadersQuery, AddLoadersMethod, RequireData, RequireDataBase, PathWithLoaders } from './definitions'
import {addBundleLoader, getRequireStrings, wrapInRequireInclude, appendCodeAndCallback, expandAllRequiresForGlob} from './inject-utils'
import {get} from 'lodash'

const invalidationDebounceDirectory = new WeakMap<any, Map<string, NodeJS.Timer>>()
export function cacheInvalidationDebounce(cacheKey: string, cache: MapCache, dictionaryKey: any, debounceMs = 10000) {
  let invalidationDebounce = invalidationDebounceDirectory.get(dictionaryKey)
  if (!invalidationDebounce) {
    invalidationDebounce = new Map<string, NodeJS.Timer>()
    invalidationDebounceDirectory.set(dictionaryKey, invalidationDebounce)
  }
  const previousTimeout = invalidationDebounce.get(cacheKey)
  invalidationDebounce.delete(cacheKey)
  if (previousTimeout) clearTimeout(previousTimeout)
  const timeout = setTimeout(() => cache.delete(cacheKey), debounceMs)
  timeout.unref() // do not require the Node.js event loop to remain active
  invalidationDebounce.set(cacheKey, timeout)
}

export const getFilesInDir = memoize(getFilesInDirBase, (directory: string, {
      skipHidden = true, recursive = false, regexFilter = undefined, emitWarning = console.warn.bind(console), emitError = console.error.bind(console), fileSystem = fs, regexIgnore = [/node_modules/], returnRelativeTo = directory
    }: GetFilesInDirOptions = {}) => {
  /** valid for 10 seconds before invalidating cache **/
  const cacheKey = `${directory}::${skipHidden}::${recursive}::${regexFilter}::${regexIgnore.join('::')}`
  cacheInvalidationDebounce(cacheKey, getFilesInDir.cache, fileSystem)
  return cacheKey
})

export interface GetFilesInDirOptions {
  skipHidden?: boolean
  recursive?: boolean
  regexFilter?: RegExp
  emitWarning?: (warn: string) => void
  emitError?: (warn: string) => void
  fileSystem?: { readdir: Function, stat: Function }
  regexIgnore?: Array<RegExp>
  /**
   * If set to a path, additionally returns the part of the path
   * starting from the directory base without the leading './'
   */
  returnRelativeTo?: string
}

export async function getFilesInDirBase(directory: string, {
      skipHidden = true, recursive = false, regexFilter = undefined, emitWarning = console.warn.bind(console), emitError = console.error.bind(console), fileSystem = fs, regexIgnore = [/node_modules/], returnRelativeTo = directory
    }: GetFilesInDirOptions = {}
  ): Promise<Array<{ filePath: string, stat: fs.Stats, relativePath: string }>> {

  if (!directory) {
    emitError(`No directory supplied`)
    return []
  }

  let files = await new Promise<string[]>((resolve, reject) =>
    fileSystem.readdir(directory, (err, value) => err ? resolve([]) || emitWarning(`Error when trying to load ${directory}: ${err.message}`) : resolve(value)))

  if (regexIgnore && regexIgnore.length) {
    files = files
      .filter(filePath => !regexIgnore.some(regex => regex.test(filePath)))
  }

  if (skipHidden) {
    files = files
      .filter(filePath => path.basename(filePath)[0] !== '.')
  }

  files = files.map(filePath => path.join(directory, filePath))

  let stats = (await Promise.all(
    files
      .map(filePath => new Promise<{ filePath: string, stat: fs.Stats, relativePath: string }>((resolve, reject) =>
        fileSystem.stat(filePath, (err, stat) =>
          err ? resolve({filePath, stat, relativePath: ''}) :
          resolve({filePath, stat, relativePath: path.relative(returnRelativeTo, filePath)})
        )
      ))
  )).filter(stat => !!stat.stat)

  if (regexFilter) {
    stats = stats
      .filter(file =>
        !(file.stat.isFile() && !file.filePath.match(regexFilter))
      )
  }

  if (!recursive)
     return stats.filter(file => file.stat.isFile())

  const subDirectoryStats = await Promise.all(
    stats.filter(file => file.stat.isDirectory()).map(
      file => getFilesInDir(file.filePath, {
        skipHidden, recursive, regexFilter, emitWarning, emitError, fileSystem, regexIgnore, returnRelativeTo
      })
    )
  )

  return stats.filter(file => file.stat.isFile()).concat(
    ...subDirectoryStats
  )
}

// export async function concatPromiseResults<T>(values: (Array<T> | PromiseLike<Array<T>>)[]): Promise<T[]> {
export async function concatPromiseResults<T>(values: Array<PromiseLike<Array<T>>>): Promise<Array<T>> {
  return ([] as Array<T>).concat(...(await Promise.all<Array<T>>(values)))
}

export interface ResourcesInput {
  path: Array<string> | string
  lazy?: boolean
  bundle?: string
  chunk?: string
}

export function getResourcesFromList(json: Object, propertyPath: string) {
  const resources = get(json, propertyPath, [] as Array<ResourcesInput | string>)

  const allResources = [] as Array<RequireDataBase>

  resources.forEach(input => {
    const r = input instanceof Object && !Array.isArray(input) ? input as ResourcesInput : { path: input }
    const paths = Array.isArray(r.path) ? r.path : [r.path]
    paths.forEach(
      literal => allResources.push({ literal, lazy: r.lazy || false, chunk: r.bundle || r.chunk })
    )
  })

  return allResources
}
