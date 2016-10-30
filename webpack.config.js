'use strict';
const webpack = require('webpack');
const webpackSources = require('webpack-sources');
const enhancedResolve = require('enhanced-resolve');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
require('ts-node').register();

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
        loaders: [{ loader: 'html' }]
      },
      {
        test: /\.js$/,
        include: [path.resolve('app/main.js')],
        loader: 'convention-loader',
        query: {
          convention: 'all-files-matching-regex',
          regex: /\.js$/,
          directory: path.resolve('app-extra')
        }
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
    },
    extensions: [".webpack-loader.js", ".web-loader.js", ".loader.js", ".js", ".ts"]
  },
  resolve: {
    modules: [
      path.resolve("app"),
      "node_modules"
    ],
    extensions: ['.js']
  },
  plugins: [
    // This function is the `apply` function if you were to create an external plugin
    // Having it inline provides some nice conviences for debugging and development
    function() {
      var compiler = this;
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
