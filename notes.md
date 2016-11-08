# Notes

TODO:
  - use the function in the webpack config in all loaders
  - fork (or require) bundle loader https://github.com/webpack/bundle-loader/blob/master/index.js 
    and add a parameter, e.g. module.exports.SIGNIFIER = true
    so that its clear to the aurelia-loader its an unresolved method
  - processDependencies for getResourcesRecursively
  - when adding resources from list, allow them to be relative to package "main" 
  - OR simply try resolving as ${module_name}/thing FIRST
  - add the option to use the package.json dependencies only as the SINGLE SOURCE OF TRUTH, 
    but not add any external dependencies from it for the local package (only for dependencies)   
note:
- globbed paths MUST include extensions

- require.include loaders:
  - comment-include-loader:
      /* @import */ 'module'
      /* @import @lazy @ */ 'module'
      /* @import('thing/*/also/works') @lazy @ */ 'module' <<- globs will not work in comments cause of /**/
      
  - conventional-include-loader (include related files according to passed in function(fs)) [eg. like-named require loader for .html files]
  - template require loader
      <require from="..." lazy bundle="abc"> (and others - configurable?)
      add ${} globbing by:
        - splitting path by '/'
        - find first component where * is
        - resolve previous one || contextDir
        - get all files recursively
        - split their paths '/'
        - add all that match the regex 
  - explicit loader: 
      adds all dependencies listed in a JSON file to a given, individual file (entry?)
      expose a method to check if a path should override/add loaders by query configuration
  - resolve plugin for /dist/es2015 auto-resolve stuff
  - add main package.json to dependencies with the loader so webpack reloads when it changes
  - custom CSS loaders for HTML requires
  - relative moduleId loader OR see plugin idea
      sets ModuleID:
        - use relative to any of config.modules (node_modules, app)
        - no JS extensions
        - rewrite paths for aurelia (strip /dist/node_modules/)
        - strip nested node_modules/.../node_modules
        - just do: package_name/request
        - for /index do package_name
        - name loader-based modules with a prefix: LOADER!NAME
        - aurelia loader checks cache for normal module name, then for bundle!NAME
      sets this._module.id relative to resolve.root config
      optionally drops extension (.js .ts)
      maybe extra module property instead of ID?
      use a prefix?
- PLUGIN: use root module from node_modules if version range satisfied
- PLUGIN: add a statically named custom module that's loaded in the aurelia-loader
    export = function(moduleId) {
      var map = {
        'aurelia-module-id': 2 // webpack moduleId
      }
    }
    see webpack/lib/ContextModule.js
    and Module.prototype.source / ExternalModule
    or maybe hook somewhere where list of all modules is generated?

    alternatively, generate the list dynamically in client
    and TODO this later properly 

    after all modules are resolved 


- template lint plugin
