# Notes

- https://github.com/TheLarkInn/webpack-developer-kit

- require.include loaders:
  - comment-include-loader:
      /* @import */ 'module'
      /* @import @lazy @ */ 'module'
  - conventional-include-loader (include related files according to passed in function(fs)) [eg. like-named require loader for .html files]
  - explicit loader: 
      adds all dependencies listed in a JSON file to a given, individual file (entry?)
  - template require loader
      <require from="..." lazy bundle="abc"> (and others - configurable?)
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
