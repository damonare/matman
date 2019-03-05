import fs from 'fs';
import path from 'path';

import _ from 'lodash';

import BaseHandle from './BaseHandle';
import ScreenshotConfig from './SceenshotConfig';
import DeviceConfig from './DeviceConfig';

import { findCrawlerParser } from '../util';

/**
 * 测试用例处理类
 */
export default class CaseParser {
    /**
     * 构造函数
     *
     * @param {String} basePath  测试用例的脚本目录
     * @param {Object} [opts] 参数
     */
    constructor(basePath, opts = {}) {
        // 项目根目录
        this.basePath = this._getBasePath(basePath);
    }

    /**
     * 获得指定脚本构建之后的本地绝对路径，以便后续加入到 nightmare 中执行
     *
     * @param {String} relativePath 相对路径
     * @return {String} 构建之后的本地绝对路径，如果不存在则返回空字符串
     */
    getCrawlerScriptPath(relativePath) {
        // 根据配置内容获得 crawlerParser 的对象
        const crawlerParser = findCrawlerParser(this.basePath);

        // 有可能找不到
        if (!crawlerParser) {
            return '';
        }

        // 获取 crawler script 的源文件目录
        const crawlerScriptSrcPath = path.resolve(this.basePath, relativePath);

        // 调用 crawlerParser 的方法获得该脚本构建之后的路径
        return crawlerParser.getCrawlerScriptPath(crawlerScriptSrcPath);
    }

    /**
     * 模拟用户进行交互操作
     *
     * @param {String} pageUrl 页面的 URL 地址
     * @param {String} crawlerScriptPath 运行在浏览器中的前端爬虫脚本，需要是绝对路径
     * @param {Object} [opts] 额外参数
     * @param {Boolean} [opts.show] 是否需要展示浏览器，默认为 false
     * @param {String} [opts.proxyServer] 代理服务器，例如 127.0.0.1:8899
     * @param {String | Number} [opts.wait] wait配置，会直接透传给 nightmare 的 wait 配置项，详细请查看 https://github.com/segmentio/nightmare#waitms
     * @param {Boolean} [opts.doNotEnd] 是否在执行完成之后不要关闭浏览器，默认为 false
     * @param {String} [opts.cookie] 为浏览器注入cookie，格式与 document.cookie 一致
     * @param {Object} [opts.mockstarQuery] 指定 mockstar 的query参数，用于数据打桩
     * @param {Boolean} [opts.useRecorder] 是否使用记录器记录所有浏览器行为，包括请求等
     * @param {String | Boolean | Object} [opts.screenshot] 截图设置
     * @param {String | Object} [opts.device] 设备设置
     * @param callAction
     * @returns {Promise<*>}
     */
    handleOperate(pageUrl, crawlerScriptPath, opts = {}, callAction) {
        let baseHandleOpts = _.merge({}, opts);

        // 如果配置了截图，则需要特殊处理下
        if (opts.screenshot) {
            baseHandleOpts.screenshotConfig = new ScreenshotConfig(opts.screenshot, this.basePath);
        }

        // 设备信息，默认为 mobile
        baseHandleOpts.deviceConfig = new DeviceConfig(opts.device || 'mobile');

        let baseHandle = new BaseHandle(pageUrl, crawlerScriptPath, baseHandleOpts);

        // 用户的自定义行为
        if (typeof callAction === 'function') {
            callAction(baseHandle);
        }

        return baseHandle.getResult();
    }

    /**
     * 适合简单的页面扫描场景，无交互行为。
     *
     * @param pageUrl
     * @param crawlerScriptPath
     * @param opts
     * @returns {Promise<*>}
     */
    handleScan(pageUrl, crawlerScriptPath, opts) {
        return this.handleOperate(pageUrl, crawlerScriptPath, opts, (testAction) => {
            // scan 行为是一种特殊的操作，因为它只有一个行为，且结果也不再是数组
            testAction.addAction(function (nightmareRun) {
                return nightmareRun.wait(opts.wait || 500);
            });
        })
            .then(function (result) {
                // 去掉这个nightmare的返回。目前他没有什么其他的用处，但是在 JSON.stringify 时会报错
                if (result.globalInfo && result.globalInfo.recorder && result.globalInfo.recorder.nightmare) {
                    delete result.globalInfo.recorder.nightmare;
                }

                // 由于此处返回的是一个元素的数组，不便于后续处理，因此需要转义为对象返回
                result.data = result.data[0];

                return result;
            });
    }

    _getBasePath(basePath) {
        let result = path.isAbsolute(basePath) ? basePath : path.resolve(basePath);

        if (!fs.existsSync(result)) {
            throw new Error('Unknown basePath=' + result);
        }

        return result;
    }
}
