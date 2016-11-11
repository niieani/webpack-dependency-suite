# Notes

## TODO
  - better easy-webpack: config is an pure object AND a list of packages to be installed as dev-dependencies
  - generator of require.include duplicate plugins, so that we can better name reasons when doing --display-reasons
  - think about globs in comments (can't do them now)
  - (maybe) fork (or require) bundle loader https://github.com/webpack/bundle-loader/blob/master/index.js 
    and add a parameter, e.g. module.exports.SIGNIFIER = true
    so that its clear to the aurelia-loader its an unresolved method
  - add tests for adding resources from list when they are relative to package's "main" (currently tries resolving as ${module_name}/thing FIRST)
  - document the option to use the package.json dependencies only as the SINGLE SOURCE OF TRUTH, 
    without adding any external dependencies from it for the local package (maybe: only for dependencies)
  - add main package.json to dependencies with the loader so webpack reloads when it changes

## Other ideas
- PLUGIN: add a statically named custom module that's loaded in the aurelia-loader
  ```js
  export = function(moduleId) {
    var map = {
      'aurelia-module-id': 2 // webpack moduleId
    }
  }
  ```

  see webpack/lib/ContextModule.js
  and Module.prototype.source / ExternalModule
  or maybe hook somewhere where list of all modules is generated?

  alternatively, generate the list dynamically in client
  and TODO this later properly 

  after all modules are resolved
- template lint plugin
- custom CSS loaders for HTML requires

## Dev Notes

```
/**
  * to list all already previously resources, iterate:
  * loader._compilation.modules[0].resource (or userRequest ?)
  * then loader._compilation.modules[0].issuer.resource / userRequest will contain the origin of the addition
  */
```
- its enough if list-based require only cares about its OWN resources
  resources of the request being made.
- maybe extra module property instead of ID?
