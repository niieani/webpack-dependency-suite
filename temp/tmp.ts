// import { WebpackConfig } from '@easy-webpack/core';

import * as webpack from 'webpack'
import * as path from 'path'
import * as acorn from 'acorn'
import * as walk from 'acorn/dist/walk'
import * as debugPkg from 'debug'

const debug = debugPkg('custom-plugin')

class CustomPlugin {
  apply(compiler) {
    compiler.plugin('context-module-factory', function (cmf) {
      debug('context-module-factory')

      cmf.plugin('before-resolve', (result, callback) => {
        debug('cmf before-resolve')
        return callback(undefined, result)
      })
      cmf.plugin('after-resolve', (result, callback) => {
        debug('cmf after-resolve')
        if (!result) return callback()
        return callback(null, result)
      })
    })

    compiler.plugin('compilation', function(compilation, data) {
      debug('compilation')
      // debug('compilation', compilation, data)
      compilation.plugin('finish-modules', function(modules) {
        debug('finish-modules', modules)
      })
      // compilation.plugin('normal-module-loader', function(loaderContext, module) {
      //   debug('normal-module-loader', module)
      // })
      data.normalModuleFactory.plugin('parser', function(parser, options) {
        parser.plugin('program', function(ast, comments) {
          // debug('program ast', ast)
          // debug('program body', ast.body[2].expression.arguments[0])
          // debug('program comments', comments)
          comments
            .filter(comment => comment.type === 'Block' && comment.value.trim() === 'import')
            .forEach(comment => {
              let result = walk.findNodeAfter(ast, comment.end)
              if (result.node && result.node.type === 'Literal') {
                debug('found', result.node.value)
              }
            })
          // debug('this', this)
          // this.state.current / module
        })
      })
    })

    // compiler.parser.plugin("evaluate Literal", function (expr) {
    //   debug('literal', expr)
    //   //if you original module has 'var rewrite'
    //   //you now have a handle on the expresssion object
    //   return true
    // })
/*
    compiler.plugin('normal-module-factory', function (nmf) {
      nmf.plugin('before-resolve', (result, callback) => {
        debug('nmf before-resolve')
        return callback(undefined, result)
      })
      nmf.plugin('after-resolve', (result, callback) => {
        debug('nmf after-resolve')
        if (!result) return callback()
        return callback(null, result)
      })
    })
*/
  }
}

export = function(environment: string) {
  console.log(environment)
  return {
    entry: path.resolve('test/index'),
    output: {
      filename: 'test/output/index.[name].js',
      devtoolModuleFilenameTemplate: '[resource-path]'
    },
    plugins: [
      new CustomPlugin()
    ],
    devtool: 'source-map',
    // resolve: {

    // },
    module: {
      rules: [
        {
          test: /\.js$/,
          include: [path.resolve('test')],
          exclude: [path.resolve('test/output')],
          // include: [path.resolve('test/included')],
          loaders: ['./explicit-loader']
        }
      ]
    }
  }
}
