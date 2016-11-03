# Notes

TODO:
  - add default extensions for globbed resources in case a glob does not contain one

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
  - fork (or require) bundle loader https://github.com/webpack/bundle-loader/blob/master/index.js 
    and add a parameter, e.g. module.exports.SIGNIFIER = true
    so that its clear to the aurelia-loader its an unresolved method
  - add main package.json to dependencies with the loader so webpack reloads when it changes
  - relative moduleId loader OR see plugin idea
      sets this._module.id relative to resolve.root config
      optionally drops extension (.js .ts)
      maybe extra module property instead of ID?
      use a prefix?
- PLUGIN: use root module from node_modules if version range satisfied
- PLUGIN: add a statically named custom module that's loaded in the aurelia-loader --- nope, these change! or do they?
    export = function(moduleId) {
      var map = {
        'aurelia-module-id': 2 // webpack moduleId
      }
    }

    after all modules are resolved 


- template lint plugin
