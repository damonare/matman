'use strict';

const webpack = require('webpack');
const Builder = require('./builder');
const utils = require('../utils');

/**
 * 获得 webpack 的配置结果
 *
 * @param {Object} [opts] 额外选项，可覆盖 config.js 中的配置
 * @param {Boolean} [isDevBuild] 是否为开发模式
 * @return {Promise}
 */
function getWebpackConfig(opts, isDevBuild) {
  return utils.getConfig()
    .then((data) => {
      // console.log('config.getConfig then', data);

      return Builder.createProdConfig(data, opts, isDevBuild);
    });
}

function runBuild(webpackConfig, callback) {
  // 这个参数是临时值，传递给 webpack 时移除之
  delete webpackConfig._configParams;
  delete webpackConfig._crawlerParser;

  webpack(webpackConfig, (err, stats) => {
    if (err) {
      throw err;
    }

    console.log(stats.toString({
      chunks: false,
      colors: true,
      children: false
    }));

    callback();
  });
}

module.exports = {
  getWebpackConfig: getWebpackConfig,
  runBuild: runBuild
};
