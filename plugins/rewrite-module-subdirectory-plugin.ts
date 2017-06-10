import { splitRequest } from '../utils/inject'
import * as path from 'path'
import * as debug from 'debug'
const log = debug('rewrite-subdir-plugin')

/**
 * Webpack Resolve plugin, used to check in additional places for the root directory of a given module
 */
export class RewriteModuleSubdirectoryPlugin {
  constructor(public getIndexPath: (moduleName: string, remainingRequest: string, request: any) => string) {}

  apply(resolver) {
    const getIndexPath = this.getIndexPath
    resolver.plugin('raw-module', async (request, callback) => {
      if (path.isAbsolute(request.request))
        return callback()

      const { moduleName, remainingRequest } = await splitRequest(request.request)
      if (!moduleName)
        return callback()
      const newRequest = getIndexPath(moduleName, remainingRequest, request)
      if (!newRequest) return callback()
      log(`${request.request} => ${newRequest}`)
      const obj = Object.assign({}, request, {
          request: newRequest
      })
      resolver.doResolve('module', obj, `looking for modules in ${newRequest}`, callback, true)
    })
  }
}


// class DynamicMainPlugin {
//   constructor(public getIndexPath: (request) => string) {}

//   apply(resolver) {
//     const getIndexPath = this.getIndexPath
//     // "existing-directory", item, "resolve"
//     resolver.plugin("existing-directory", (request, callback) => {
// 		  // if (request.path !== request.descriptionFileRoot) return callback();
//       const filename = getIndexPath(request)
//       if (!filename) return callback()
//       const fs = resolver.fileSystem;
//       const topLevelCallback = callback;
//       const filePath = resolver.join(request.path, filename);
//       const obj = Object.assign({}, request, {
//           path: filePath,
//           relativePath: request.relativePath && resolver.join(request.relativePath, filename)
//       });
//       resolver.doResolve("undescribed-raw-file", obj, `using path: ${filePath}`, callback);
//     });
//   }
// }

// export = DynamicMainPlugin
