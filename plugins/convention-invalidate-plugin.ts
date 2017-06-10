import * as debug from 'debug'
const log = debug('convention-invalidate-plugin')

export class ConventionInvalidatePlugin {
  constructor(public getInvalidationList = differentExtensionTransformer) { }

  apply(compiler) {
    compiler.plugin('after-environment', () => {
      compiler.watchFileSystem = new TransformWatchFileSystem(compiler.watchFileSystem, compiler, this.getInvalidationList)
    })
  }
}

export class TransformWatchFileSystem {
  constructor(public wfs, public compiler, public getInvalidationList: OnChangedTransformer) {}

  // getters mapping to origin:
  get inputFileSystem() { return this.wfs.inputFileSystem }
  get watcherOptions() { return this.wfs.watcherOptions }
  // needed for ts-loader:
  get watcher() { return this.wfs.watcher }

  watch(files, dirs, missing, startTime, options, callback: Function, callbackUndelayed: Function) {
    this.wfs.watch(files, dirs, missing, startTime, options,
    (
      err: Error,
      filesModified: Array<string>,
      dirsModified: Array<string>,
      missingModified: Array<string>,
      fileTimestamps: Timestamps,
      dirTimestamps: Timestamps) => {
      if (err) return callback(err)

      const watchedPaths = Object.keys(fileTimestamps)
      const pathsToInvalidate = this.getInvalidationList(filesModified, watchedPaths, this.compiler)
      pathsToInvalidate.forEach(filePath => {
        log(`Invalidating: ${filePath}`)
        fileTimestamps[filePath] = Date.now()
        filesModified.push(filePath)
      })
      callback(err, filesModified, dirsModified, missingModified, fileTimestamps, dirTimestamps)
    },
    (filePath: string, changeTime: number) => {
      const watchedFiles = this.watcher.fileWatchers.map(watcher => watcher.path)
      const toInvalidate = this.getInvalidationList([filePath], watchedFiles, this.compiler)
      toInvalidate.forEach(file => callbackUndelayed(file, changeTime))
      callbackUndelayed.call(this.compiler, filePath, changeTime)
    })
  }
}

/**
 * "touch", or invalidate all files of the same same path, but different extension
 */
export const differentExtensionTransformer = function differentExtensionTransformer(changedPaths, watchedFiles: string[]) {
  const pathsToInvalidate = [] as Array<string>
  changedPaths.forEach(filePath => {
    const pathWithoutExtension = filePath.replace(/\.[^/.]+$/, '')
    const relatedFiles = watchedFiles
      .filter(watchedPath => watchedPath.indexOf(pathWithoutExtension) === 0 && watchedPath !== filePath)
    pathsToInvalidate.push(...relatedFiles)
  })
  return pathsToInvalidate
} as OnChangedTransformer

export type OnChangedTransformer = (changed: Array<string>, watchedFiles?: Array<string>, compiler?: any) => Array<any>
export interface Timestamps { [path: string]: number }
export interface WatchResult {
  filesModified: Array<string>
  dirsModified: Array<string>
  missingModified: Array<string>
  fileTimestamps: Timestamps
  dirTimestamps: Timestamps
}
