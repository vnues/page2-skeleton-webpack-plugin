'use strict'

/* eslint-disable max-len */
const merge = require('lodash/merge')
const webpack = require('webpack')
const htmlWebpackPlugin = require('html-webpack-plugin')
const optionsSchema = require('./config/optionsSchema.json')
const Server = require('./server')
const { addScriptTag, outputSkeletonScreen, snakeToCamel } = require('./util')
const { defaultOptions, staticPath } = require('./config/config')
const OptionsValidationError = require('./config/optionsValidationError')

const EVENT_LIST = process.env.NODE_ENV === 'production' ? ['watch-close', 'failed', 'done'] : ['watch-close', 'failed']
// eslint-disable-next-line line-comment-position
const PLUGIN_NAME = 'pageSkeletonWebpackPlugin' // 插件名称 ===>理解成eventType

function SkeletonPlugin(options = {}) {
  const validationErrors = webpack.validateSchema(optionsSchema, options)
  // ! 校验参数
  if (validationErrors.length) {
    throw new OptionsValidationError(validationErrors)
  }
  // ! 合并配置
  this.options = merge({ staticPath }, defaultOptions, options)
  this.server = null
  this.originalHtml = ''
}

// ! 创建一个server服务
SkeletonPlugin.prototype.createServer = function () { // eslint-disable-line func-names
  if (!this.server) {
    const server = this.server = new Server(this.options) // eslint-disable-line no-multi-assign
    server.listen().catch(err => server.log.warn(err))
  }
}

// ! 插入一段脚本到客户端 这段脚本就是client-socket脚本
SkeletonPlugin.prototype.insertScriptToClient = function (htmlPluginData) { // eslint-disable-line func-names
  // at develop phase, insert the interface code
  if (process.env.NODE_ENV !== 'production') {
    const { port } = this.options
    const clientEntry = `http://localhost:${port}/${staticPath}/index.bundle.js`
    // ! clientEntry http://localhost:7890/__webpack_page_skeleton__/index.bundle.js
    console.log('clientEntry', clientEntry)
    // eslint-disable-next-line line-comment-position
    const oldHtml = htmlPluginData.html // 这是使用到了html-webpack-plugin插件
    htmlPluginData.html = addScriptTag(oldHtml, clientEntry, port)
  }
}

// ! 输出骨架屏源码替换<---shell.js--->占位符
SkeletonPlugin.prototype.outputSkeletonScreen = async function () { // eslint-disable-line func-names
  try {
    await outputSkeletonScreen(this.originalHtml, this.options, this.server.log.info)
  } catch (err) {
    this.server.log.warn(err.toString())
  }
}

/**
 * ! 插件是由「具有 apply 方法的 prototype 对象」所实例化出来的。这个 apply 方法在安装插件时，会被 webpack compiler 调用一次
 */
SkeletonPlugin.prototype.apply = function (compiler) { // eslint-disable-line func-names
  // ! 以下生命周期钩子函数，是由 compiler 暴露，可以通过如下方式访问
  if (compiler.hooks) {
    // ! 在 entry 配置项处理过之后，执行插件
    compiler.hooks.entryOption.tap(PLUGIN_NAME, () => {
      /**
       * ! 插件被调用过程会启动一个server服务
       */
      this.createServer()
    })
    // ! compilation 对象代表了一次资源版本构建 tap===>监听 窃听
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      const htmlWebpackPluginBeforeHtmlProcessing = compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing || htmlWebpackPlugin.getHooks(compilation).afterTemplateExecution
      htmlWebpackPluginBeforeHtmlProcessing.tapAsync(PLUGIN_NAME, (htmlPluginData, callback) => {
        // ! 资源在构建完插入一段client-socket脚本
        this.insertScriptToClient(htmlPluginData)
        callback(null, htmlPluginData)
      })
      const htmlWebpackPluginAfterHtmlProcessing = compilation.hooks.htmlWebpackPluginAfterHtmlProcessing || htmlWebpackPlugin.getHooks(compilation).beforeEmit
      htmlWebpackPluginAfterHtmlProcessing.tapAsync(PLUGIN_NAME, (htmlPluginData, callback) => {
        this.originalHtml = htmlPluginData.html
        callback(null, htmlPluginData)
      })
    })
    // ! 生成资源到 output 目录之后
    compiler.hooks.afterEmit.tap(PLUGIN_NAME, async () => {
      await this.outputSkeletonScreen()
    })
    /**
     * ! ['watch-close', 'failed', 'done']
     * ! 编译(compilation)完成、失败、监听模式停止就关闭server服务
     */
    EVENT_LIST.forEach((event) => {
      compiler.hooks[snakeToCamel(event)].tap(PLUGIN_NAME, () => {
        if (this.server) {
          this.server.close()
        }
      })
    })
  } else {
    // ! 应该兼容以前老版本的webpack 暂时可不看
    compiler.plugin('entry-option', () => {
      this.createServer()
    })

    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('html-webpack-plugin-before-html-processing', (htmlPluginData, callback) => {
        this.insertScriptToClient(htmlPluginData)
        callback(null, htmlPluginData)
      })
      compilation.plugin('html-webpack-plugin-after-html-processing', (htmlPluginData, callback) => {
        this.originalHtml = htmlPluginData.html
        callback(null, htmlPluginData)
      })
    })

    compiler.plugin('after-emit', async (compilation, done) => {
      await this.outputSkeletonScreen()
      done()
    })

    EVENT_LIST.forEach((event) => {
      compiler.plugin(event, () => {
        if (this.server) {
          this.server.close()
        }
      })
    })
  }
}

module.exports = SkeletonPlugin
