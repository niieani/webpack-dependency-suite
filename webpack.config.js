'use strict';
require('ts-node').register();
const webpack = require('webpack');
const webpackSources = require('webpack-sources');
const enhancedResolve = require('enhanced-resolve');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const log = require('debug')('config')
const RewriteModuleSubdirectoryPlugin = require('./plugins/rewrite-module-subdirectory-plugin')
const RootMostResolvePlugin = require('./plugins/root-most-resolve-plugin')

module.exports = {
  entry: {
    'main': ['./app/main.js'],
  },
  output: {
    path: path.join(__dirname,'/dist'),
    filename: '[name].bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.html$/,
        include: [path.resolve('app'), path.resolve('app-extra')],
        use: [
          {
            loader: 'html-require-loader'
          }
        ]
      },
      // {
      //   test: /\.js$/,
      //   include: [path.resolve('app/main.js')],
      //   use: [
      //     {
      //       loader: 'convention-loader',
      //       query: {
      //         convention: 'all-files-matching-regex',
      //         regex: /\.js$/,
      //         directory: path.resolve('app-extra')
      //       }
      //     },
      //   ],
      // },
      {
        test: /\.js$/,
        include: [path.resolve('app')],
        use: [
          {
            loader: 'list-based-require-loader',
            query: {
              packagePropertyPath: 'aurelia.build.resources',
              enableGlobbing: true,
              rootDir: path.resolve()
              // packagePropertyPath: string
              // enableGlobbing?: boolean
            }
          }
        ],
      },
      // We are chianing the custom loader to babel loader.
      // Purely optional but know that the `first` loader in the chain (babel in this case)
      // must always return JavaScript (as it is then processed into the compilation)
      {
        test: /\.js$/,
        include: [path.resolve('app'), path.resolve('app-extra')],
        // loaders: [
        //   'comment-loader'
        // ]
        // oneOf: [
        //   {
            loaders: [
              // 'babel',
              'comment-loader',
              {
                loader: 'convention-loader',
                query: {
                  convention: 'extension-swap'
                  // convention: function(fullPath) {
                  //   const path = require('path')
                  //   const basename = path.basename(fullPath)
                  //   const noExtension = basename.substr(0, basename.lastIndexOf('.')) || basename
                  //   const basepath = path.dirname(fullPath)
                  //   return path.join(basepath, noExtension + '.html')
                  // }
                }
              },
              // 'custom-loader',
            ],
        //   },
        // ],
      },
    ],
  },
  // This allows us to add resolving functionality for our custom loader
  // It's used just like the resolve property and we are referencing the
  // custom loader file.
  resolveLoader: {
    alias: {
      'custom-loader': require.resolve('./custom-loader'),
      'comment-loader': require.resolve('./loaders/comment-loader'),
      'convention-loader': require.resolve('./loaders/convention-loader'),
      'html-require-loader': require.resolve('./loaders/html-require-loader'),
      'list-based-require-loader': require.resolve('./loaders/list-based-require-loader'),
    },
    extensions: [".webpack-loader.js", ".web-loader.js", ".loader.js", ".js", ".ts"]
  },
  resolve: {
    modules: [
      path.resolve("app"),
      "node_modules"
    ],
    extensions: ['.js'],
    plugins: [
      // new CustomMainPlugin((request) => {
      //   const moduleName = request.descriptionFileData && request.descriptionFileData.name
      //   if (!moduleName) {
      //     return
      //   }
      //   // log(request)
      //   return `dist/native-modules/${moduleName}`
      // }),
      new RewriteModuleSubdirectoryPlugin((moduleName, remainingRequest, request) => {
        if (moduleName.startsWith('aurelia-'))
          return `${moduleName}/dist/native-modules/${remainingRequest || moduleName}`
      }),
      new RewriteModuleSubdirectoryPlugin((moduleName, remainingRequest, request) => {
        if (moduleName.startsWith('aurelia-'))
          return `${moduleName}/dist/commonjs/${remainingRequest || moduleName}`
      }),
      new RootMostResolvePlugin(__dirname)
    ],
    // mainFiles: ['dist/native-modules/index', 'index']
    // plugins: [new RootMostAliasPlugin('described-resolve', {}, 'resolve')]
  },
  plugins: [
    // This function is the `apply` function if you were to create an external plugin
    // Having it inline provides some nice conviences for debugging and development
    function() {
      var compiler = this;

      compiler.plugin("after-resolve", function(result, callback) {
        if(!result) return callback();
        log(result)
        // if(resourceRegExp.test(result.resource)) {
        //   if(typeof newContentResource !== "undefined")
        //     result.resource = path.resolve(result.resource, newContentResource);
        //   if(typeof newContentRecursive !== "undefined")
        //     result.recursive = newContentRecursive;
        //   if(typeof newContentRegExp !== "undefined")
        //     result.regExp = newContentRegExp;
        //   if(typeof newContentCreateContextMap === "function")
        //     result.resolveDependencies = createResolveDependenciesFromContextMap(newContentCreateContextMap);
        //   if(typeof newContentCallback === "function") {
        //     var origResource = result.resource;
        //     newContentCallback(result);
        //     if(result.resource !== origResource) {
        //       result.resource = path.resolve(origResource, result.resource);
        //     }
        //   } else {
        //     result.dependencies.forEach(function(d) {
        //       if(d.critical)
        //         d.critical = false;
        //     });
        //   }
        // }
        return callback(null, result);
      });
      compiler.plugin('compilation', function(compilation) {
        compilation.plugin('after-optimize-modules', function(modules) {
          // debugger;
        });
        compilation.plugin('after-optimize-chunks', function(chunks) {
          // debugger;
        });
      });
    },
    new HtmlWebpackPlugin({
      template: './app/index.html',
    }),
  ],
  devtool: false,
};
