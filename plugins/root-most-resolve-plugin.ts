/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
import createInnerCallback = require("enhanced-resolve/lib/createInnerCallback")
import * as getInnerRequest from "enhanced-resolve/lib/getInnerRequest"
import * as semver from 'semver'
import * as path from 'path'
import * as debug from 'debug'
const log = debug('root-most-alias')

class RootMostResolvePlugin {
  constructor(public context) {}

  apply(resolver: EnhancedResolve.Resolver) {
    let context = this.context
    resolver.plugin('resolved', async function (originalResolved: EnhancedResolve.ResolveResult, callback) {
      const previousPathSep = originalResolved.path.split(path.sep)
      const nodeModulesCount = previousPathSep.filter(p => p === 'node_modules').length
      if (nodeModulesCount <= 1) {
        return callback(null, originalResolved)
      }
      const lastNodeModulesAt = previousPathSep.lastIndexOf('node_modules')
      const actualRequestPath = previousPathSep.slice(lastNodeModulesAt + 1).join('/')
      // log(originalResolved.path, actualRequestPath, originalResolved.context)

      if (!originalResolved.context.issuer) {
        return callback(null, originalResolved)
      }
      const issuer = await new Promise<EnhancedResolve.ResolveResult | undefined>((resolve, reject) =>
        resolver.doResolve('resolve',
          { context: {}, path: originalResolved.context.issuer, request: originalResolved.context.issuer }, `resolve issuer of ${originalResolved.path}`, (err, value) => err ? resolve() : resolve(value)));

      if (!issuer) {
        return callback(null, originalResolved)
      }

      const resolvedInParentContext = await new Promise<EnhancedResolve.ResolveResult | undefined>((resolve, reject) =>
        resolver.doResolve('resolve', {
          context: originalResolved.context,
          path: context,
          request: actualRequestPath
        }, `resolve ${actualRequestPath} in ${context}`, createInnerCallback((err, value) => err ? resolve() : resolve(value), callback, null)));

      if (!resolvedInParentContext) {
        return callback(null, originalResolved)
      }

      const resolvedVersion = resolvedInParentContext.descriptionFileData && resolvedInParentContext.descriptionFileData.version
      const packageName = resolvedInParentContext.descriptionFileData && resolvedInParentContext.descriptionFileData.name
      const allowedRange = issuer.descriptionFileData.dependencies[packageName]
      log(`Analyzing whether package ${packageName}=${allowedRange} can be substituted by a parent version ${resolvedVersion}`)

      if (resolvedVersion && packageName && allowedRange && semver.satisfies(resolvedVersion, allowedRange, true)) {
        const firstNodeModulesAt = previousPathSep.indexOf('node_modules')
        const actualOldRequestPath = previousPathSep.slice(firstNodeModulesAt + 1).join('/')

        log(`Rewriting ${actualOldRequestPath} with ${actualRequestPath}`)
        return callback(null, resolvedInParentContext)
      } else {
        return callback(null, originalResolved)
      }
    })
  }
}

export = RootMostResolvePlugin;
