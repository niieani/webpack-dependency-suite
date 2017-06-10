import {get} from 'lodash'
import createInnerCallback = require('enhanced-resolve/lib/createInnerCallback')
import * as getInnerRequest from 'enhanced-resolve/lib/getInnerRequest'
import * as semver from 'semver'
import * as path from 'path'
import * as debug from 'debug'
const log = debug('root-most-resolve-plugin')

function getDependencyVersion(packageJson: Object, packageName: string): string {
  return get(packageJson, ['dependencies', packageName]) ||
    get(packageJson, ['devDependencies', packageName]) ||
    get(packageJson, ['optionalDependencies', packageName]) ||
    get(packageJson, ['peerDependencies', packageName])
}

/**
 * @description Uses the root-most package instead of a nested node_modules package.
 * Useful when doing 'npm link' for nested dependencies,
 * so you can be sure all packages use the right copy of the given module.
 */
export class RootMostResolvePlugin {
  constructor(public context: string, public force?: boolean, public overwriteInvalidSemVer = true) {}

  apply(resolver: EnhancedResolve.Resolver) {
    let context = this.context
    let force = this.force
    let overwriteInvalidSemVer = this.overwriteInvalidSemVer

    resolver.plugin('resolved', async function (originalResolved: EnhancedResolve.ResolveResult, callback) {
      if (originalResolved.context['rootMostResolve']) {
        // do not loop!
        return callback(null, originalResolved)
      }

      const previousPathSep = originalResolved.path.split(path.sep)
      const nodeModulesCount = previousPathSep.filter(p => p === 'node_modules').length
      const relativeToContext = path.relative(context, originalResolved.path)
      if (!force && !relativeToContext.includes(`..`) && nodeModulesCount <= 1) {
        return callback(null, originalResolved)
      }
      const lastNodeModulesAt = previousPathSep.lastIndexOf('node_modules')
      const actualRequestPath = previousPathSep.slice(lastNodeModulesAt + 1).join('/')

      if (!originalResolved.context || !originalResolved.context.issuer) {
        return callback(null, originalResolved)
      }

      const issuer = await new Promise<EnhancedResolve.ResolveResult | undefined>((resolve, reject) =>
        resolver.doResolve('resolve',
          { context: { rootMostResolve: true }, path: originalResolved.context.issuer, request: originalResolved.context.issuer }, `resolve issuer of ${originalResolved.path}`, (err, value) => err ? resolve() : resolve(value)));

      if (!issuer) {
        return callback(null, originalResolved)
      }

      const resolvedInParentContext = await new Promise<EnhancedResolve.ResolveResult | undefined>((resolve, reject) =>
        resolver.doResolve('resolve', {
          context: {}, // originalResolved.context,
          path: context,
          request: actualRequestPath
        }, `resolve ${actualRequestPath} in ${context}`, createInnerCallback((err, value) => err ? resolve() : resolve(value), callback, null)));

      if (!resolvedInParentContext) {
        return callback(null, originalResolved)
      }

      const resolvedVersion = resolvedInParentContext.descriptionFileData && resolvedInParentContext.descriptionFileData.version
      const packageName = resolvedInParentContext.descriptionFileData && resolvedInParentContext.descriptionFileData.name
      const allowedRange = getDependencyVersion(issuer.descriptionFileData, packageName)
      const isValidRange = allowedRange && semver.validRange(allowedRange)

      log(`Analyzing whether package ${packageName}@${allowedRange} can be substituted by a parent version ${resolvedVersion}`)

      if (!isValidRange)
        log(`Package ${packageName} has an invalid SemVer range, ${overwriteInvalidSemVer ? 'overwriting anyway' : 'not overwriting'}`)

      if (resolvedVersion && packageName && allowedRange && ((!isValidRange && overwriteInvalidSemVer) || semver.satisfies(resolvedVersion, allowedRange, true))) {
        log(`Rewriting ${relativeToContext} with ${actualRequestPath}`)
        return callback(null, resolvedInParentContext)
      } else {
        return callback(null, originalResolved)
      }
    })
  }
}
