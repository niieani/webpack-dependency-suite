import { concatPromiseResults, getResourcesFromList } from './utils'
import { addBundleLoader, expandAllRequiresForGlob, resolveLiteral } from './inject-utils'
import { PathWithLoaders, RequireData, RequireDataBaseResolved } from './definitions'

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
async function addLoadersMethod(packageJson: Object, rootDir: string, files: Array<RequireData>, loaderInstance: Webpack.Core.LoaderContext): Promise<Array<PathWithLoaders>> {
  const resources = getResourcesFromList(packageJson, 'aurelia.build.resources')
  const resourceData = await addBundleLoader(resources, loaderInstance, 'loaders')
  const globbedResources = await expandAllRequiresForGlob(resourceData, loaderInstance)
  const resolvedResources = await concatPromiseResults<RequireDataBaseResolved & { loaders?: Array<string> }>(
    globbedResources.map(async r => resolveLiteral(r, loaderInstance, rootDir))
  )
  return files.map(f => {
    const resolvedFile = resolvedResources.find(rr => rr.resolve.path === f.resolve.path)
    return { path: f.resolve.path, loaders: (resolvedFile && resolvedFile.loaders) || undefined }
    // return (resolvedFile && resolvedFile.loaders) ? (Object.assign(f, { loaders: resolvedFile.loaders })) : f
  })

  // return enforcedLoadersFiles.map(f => ({
  //   path: f.resolve.path,
  //   loaders: f.loaders
  // }))
}
