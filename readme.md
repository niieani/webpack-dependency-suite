# Webpack Dependency Suite
A set of loaders, plugins and utilities designed to help with adding custom dependencies to your project.

## Usage
TODO.

## Parts of the Suite

### `require.include` loaders

- comment-include-loader:
```js
    /* @import */ 'module'
    /* @import @lazy @ */ 'module'
    /* @import('thing\/*\/also\/works') @lazy @ */ 'module' // <<- globs will not work in comments cause of /**/ unless you escape slashes
```
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
- note: globbed paths MUST include extensions

### Resolve Plugins

- resolve plugin for trying nested directories auto-resolve stuff (e.g. Aurelia's `/dist/es2015`)
- resolve plugin to use root module from node_modules if version range satisfied

### Normal Use Plugins

- mapped relative moduleId plugin
    sets ModuleID:
      - use relative to any of config.modules (node_modules, app)
      - no JS extensions
      - rewrite paths for aurelia (strip /dist/node_modules/)
      - strip nested node_modules/.../node_modules
      - just do: package_name/request
      - for /index do package_name
      - name loader-based modules with a prefix: LOADER!NAME
      - aurelia loader checks cache for normal module name, then for async!NAME
    sets module.id relative to configured directory
    optionally keeps extension (.js .ts)

## Development / Debugging
There are two scripts that are setup already: 

* `npm run dev`
  * will run the same configuration instead with webpack-dev-server for live reload

* `npm run build`
  * will simply execute a webpack build in the repo

* `npm run debug`
	* will run the same build with node debugger.
	* paste provided link in Chrome (or Canary), and you will have the super incredible ChromeDevTools to step through your code for learning, exploration, and debugging. 

## Helpful resources: 
* [How to write a webpack loader](https://webpack.github.io/docs/how-to-write-a-loader.html)
* [How to write a plugin](https://github.com/webpack/docs/wiki/How-to-write-a-plugin)
* [Webpack Plugin API](https://webpack.github.io/docs/plugins.html)
* [webpack-sources](https://github.com/webpack/webpack-sources)
* [enhanced-resolve](https://github.com/webpack/enhanced-resolve)

## Recognition
The repository is based on the fantastic [webpack-developer-kit](https://github.com/TheLarkInn/webpack-developer-kit) by TheLarkInn, inspired by blacksonics. 
