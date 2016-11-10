import { concatPromiseResults, getResourcesFromList } from '../loaders/utils'
import { addBundleLoader, expandAllRequiresForGlob, resolveLiteral } from '../loaders/inject-utils'
import { PathWithLoaders, RequireData, RequireDataBaseResolved } from '../loaders/definitions'
import * as path from 'path'
import * as debug from 'debug'
const log = debug('aurelia')

/**
 * 1. load MAIN package.json
 * 2. get the aurelia resources: packageJson.aurelia && packageJson.aurelia.build && packageJson.aurelia.build.resources
 * 3. glob all resources
 * 4. resolve each resource in the context of MAIN package.json
 * 5. foreach files, match with resolved resources and replace loaders or return what was there
 *
 * @param {Object} packageJson
 * @param {string} rootDir
 * @param {Array<RequireData>} files
 * @param {Webpack.Core.LoaderContext} loaderInstance
 * @returns {Promise<Array<PathWithLoaders>>}
 */
export async function addLoadersMethod(rootDir: string, files: Array<RequireData>, loaderInstance: Webpack.Core.LoaderContext): Promise<Array<PathWithLoaders>> {
  let resolvedResources = loaderInstance._compilation._aureliaResolvedResources as Array<RequireData>
  if (!resolvedResources) {
    // TODO: acquire packageJson via builtin FileSystem, not Node
    const packageJsonPath = path.join(rootDir, 'package.json')
    // loaderInstance.addDependency(packageJsonPath)
    const packageJson = require(packageJsonPath)
    const resources = getResourcesFromList(packageJson, 'aurelia.build.resources')
    const resourceData = await addBundleLoader(resources, 'loaders')
    const globbedResources = await expandAllRequiresForGlob(resourceData, loaderInstance, false)
    loaderInstance._compilation._aureliaResolvedResources = resolvedResources = (await concatPromiseResults<RequireData>(
      globbedResources.map(r => resolveLiteral(r, loaderInstance, rootDir) as any /* TODO: typings */)
    )).filter(rr => !!rr.resolve)

  }

  // resolvedResources.forEach(rr => log(rr.resolve.path))
  // const hmm = files.filter(f => f.resolve.path.includes(`aurelia-templating-resources`)).map(f => f.resolve.path)
  // if (hmm.length) {
  //   log(hmm.find(f => !!resolvedResources.find(rr => rr.resolve.path === f)))
  //   const fss = resolvedResources.find(rr => rr.resolve.path === hmm.find(f => f.includes(`signal-binding`)))
  //   if (fss) log(fss)
  // }

  return files
    // .filter(f => !!f.resolve)
    .map(f => {
      const resolvedFile = resolvedResources.find(rr => rr.resolve.path === f.resolve.path)
      return { path: f.resolve.path, loaders: (resolvedFile && resolvedFile.loaders) || undefined }
    // return (resolvedFile && resolvedFile.loaders) ? (Object.assign(f, { loaders: resolvedFile.loaders })) : f
  })

  // return enforcedLoadersFiles.map(f => ({
  //   path: f.resolve.path,
  //   loaders: f.loaders
  // }))
}
