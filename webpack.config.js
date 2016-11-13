'use strict';
require('ts-node').register();
const webpack = require('webpack');
const webpackSources = require('webpack-sources');
const enhancedResolve = require('enhanced-resolve');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const log = require('debug')('config')
const RewriteModuleSubdirectoryPlugin = require('./plugins/rewrite-module-subdirectory-plugin').RewriteModuleSubdirectoryPlugin
const RootMostResolvePlugin = require('./plugins/root-most-resolve-plugin').RootMostResolvePlugin
const MappedModuleIdsPlugin = require('./plugins/mapped-module-ids-plugin').MappedModuleIdsPlugin
const AureliaAddLoadersCallback = require('./example/aurelia').addLoadersMethod
const ConventionInvalidatePlugin = require('./plugins/convention-invalidate-plugin').ConventionInvalidatePlugin
const rootDir = path.resolve()
const appDir = path.resolve(`test-fixtures/app`)

const addLoadersCallback = async (list, loaderInstance) => {
  return await AureliaAddLoadersCallback(rootDir, list, loaderInstance)
}

module.exports = {
  entry: {
    'main': ['./test-fixtures/app/main.js'],
  },
  output: {
    path: path.resolve('test-fixtures/webpack-dist'),
    filename: '[name].bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.html$/,
        include: [appDir, path.resolve('test-fixtures/app-extra')],
        use: [
          {
            loader: 'html-require-loader',
            options: {
              addLoadersCallback
            }
          }
        ]
      },
      /*
      // this would add all files matching a regex under a given directory as dependencies to the given file:
      {
        test: /\.js$/,
        include: [path.resolve('app/main.js')],
        use: [
          {
            loader: 'convention-loader',
            query: {
              convention: 'all-files-matching-regex',
              regex: /\.js$/,
              directory: path.resolve('test-fixtures/app-extra')
            }
          },
        ],
      },
      */
      {
        test: /\.js$/,
        include: [/*appDir, *//node_modules\/aurelia-/],
        use: [
          {
            loader: 'list-based-require-loader',
            options: {
              addLoadersCallback,
              packagePropertyPath: 'aurelia.build.resources',
              enableGlobbing: true,
              rootDir: path.resolve()
            }
          }
        ],
      },
      // We are chianing the custom loader to babel loader.
      // Purely optional but know that the `first` loader in the chain (babel in this case)
      // must always return JavaScript (as it is then processed into the compilation)
      {
        test: /\.js$/,
        include: [appDir, path.resolve('test-fixtures/app-extra')],
        loaders: [
          {
            loader: 'comment-loader',
            options: {
              addLoadersCallback
            }
          },
          {
            loader: 'convention-loader',
            options: {
              addLoadersCallback,
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
        ],
      },
    ],
  },
  // This allows us to add resolving functionality for our custom loader
  // It's used just like the resolve property and we are referencing the
  // custom loader file.
  resolveLoader: {
    alias: {
      'comment-loader': require.resolve('./loaders/comment-loader'),
      'convention-loader': require.resolve('./loaders/convention-loader'),
      'html-require-loader': require.resolve('./loaders/html-require-loader'),
      'list-based-require-loader': require.resolve('./loaders/list-based-require-loader'),
    },
    extensions: [".ts", ".webpack-loader.js", ".web-loader.js", ".loader.js", ".js"]
  },
  resolve: {
    modules: [
      path.resolve("test-fixtures/app"),
      "node_modules"
    ],
    extensions: ['.js'],
    plugins: [
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
  },
  plugins: [
    new MappedModuleIdsPlugin({
      appDir: appDir,
      prefixLoaders: [{loader: 'bundle-loader', prefix: 'async'}],
      logWhenRawRequestDiffers: true,
      dotSlashWhenRelativeToAppDir: false,
      beforeLoadersTransform: (moduleId) => {
        if (!moduleId.startsWith('aurelia-')) return moduleId
        return moduleId
          .replace('/dist/native-modules', '')
          .replace('/dist/commonjs', '')
      },
      afterExtensionTrimmingTransform: (moduleId) => {
        if (!moduleId.startsWith('aurelia-')) return moduleId
        const split = moduleId.split('/')
        if (split.length === 2 && split[0] === split[1]) {
          // aurelia uses custom main path
          return split[0]
        }
        return moduleId
      }
    }),
    new HtmlWebpackPlugin({
      template: './test-fixtures/app/index.html',
    }),
    new ConventionInvalidatePlugin((watchResult) => {
      return watchResult
    })
  ],
  devtool: false,
};
