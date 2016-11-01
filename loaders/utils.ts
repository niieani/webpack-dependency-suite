import * as path from 'path'
import * as fs from 'fs'

export async function getFilesInDir(directory: string, {
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
