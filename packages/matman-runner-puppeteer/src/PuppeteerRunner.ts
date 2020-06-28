import path from 'path';
import {EventEmitter} from 'events';
import fs from 'fs-extra';
import puppeteer from 'puppeteer';
import {BrowserRunner, PageDriver} from 'matman-core';
import {build} from 'matman-crawler';
import {evaluate} from './utils/master';

export class PuppeteerRunner extends EventEmitter implements BrowserRunner {
  name = 'puppeteer';
  pageDriver: PageDriver | null;
  globalInfoRecorderKey: string;
  puppeteerConfig: puppeteer.LaunchOptions;
  browser: null | puppeteer.Browser;
  page: null | puppeteer.Page;
  globalInfo: {[key: string]: any};

  constructor(opts: puppeteer.LaunchOptions = {}) {
    super();

    this.pageDriver = null;

    // 初始化配置
    this.puppeteerConfig = opts;

    // 是否使用记录器记录整个请求队列
    // 如果为 true，则可以从 this.globalInfo.recorder 中获取，
    // 如果为 字符串，则可以从 this.globalInfo[xxx] 中获取，
    this.globalInfoRecorderKey = '';

    // puppeteer 对象
    this.browser = null;
    this.page = null;

    this.globalInfo = {};
  }

  setPageDriver(n: PageDriver): void {
    this.pageDriver = n;

    this.globalInfoRecorderKey = (function (useRecorder) {
      if (!useRecorder) {
        return '';
      }

      return typeof useRecorder === 'boolean' ? 'recorder' : useRecorder + '';
    })(this.pageDriver.useRecorder);

    this.globalInfo[this.globalInfoRecorderKey] = [];
  }

  async getConfig(): Promise<void> {
    // 触发开始事件
    this.emit('beforeGetConfig');

    if (this.pageDriver) {
      if (this.pageDriver.show) {
        this.puppeteerConfig.headless = false;
      }

      // 如果传入了代理服务，则设置代理服务器
      if (this.pageDriver.proxyServer) {
        if (this.puppeteerConfig.args) {
          this.puppeteerConfig.args = [
            ...this.puppeteerConfig.args,
            `--proxy-server=${this.pageDriver.proxyServer}`,
          ];
        } else {
          this.puppeteerConfig.args = [`--proxy-server=${this.pageDriver.proxyServer}`];
        }
      }
    }

    // 如果设置了 show ，则同步打开开发者工具面板
    // puppeteer 场景下不需要这么做，可以人工打开，因此不再有必要这么处理了
    // if (this.puppeteerConfig.headless === false) {
    //   this.puppeteerConfig.devtools = true;
    // }

    // 触发广播配置
    this.emit('afterGetConfig', this.puppeteerConfig);
  }

  async getNewInstance(): Promise<void> {
    this.emit('beforeGetNewNightmare');
    // 创建 puppeteer 对象, 需要创建到 page
    this.browser = await puppeteer.launch(this.puppeteerConfig);
    this.page = (await this.browser.pages())[0];

    // 钩子事件：创建完成之后，可能会有一些自己的处理
    this.emit('afterGetNewNightmare', this);

    // 初始化行为
    this.emit('beforeInitNightmareRun', this.page);

    // 使用记录器，记录网络请求和浏览器事件等 暂时不使用
    if (this.globalInfoRecorderKey) {
      this.page.on('response', async msg => {
        const request = msg.request();

        let responseBody = null;
        if (msg.headers()['content-type'] === 'application/json') {
          try {
            responseBody = await msg.json();
          } catch (e) {
            // TODO 部分场景下可能报错，待定位
            // UnhandledPromiseRejectionWarning: SyntaxError: Unexpected token / in JSON at position 0
          }
        }

        this.globalInfo[this.globalInfoRecorderKey].push({
          url: request.url(),
          method: request.method(),
          request: {
            headers: request.headers(),
            postData: request.postData(),
          },
          response: {
            ok: msg.ok(),
            status: msg.status(),
            statusText: msg.statusText(),
            headers: msg.headers(),
            fromCache: msg.fromCache(),
            body: responseBody,
          },
        });
      });

      this.page.on('console', log => {
        this.globalInfo[this.globalInfoRecorderKey].push({
          type: log.type(),
          // args: log.args(),
          location: log.location(),
          text: log.text(),
        });
      });
    }

    // 设置额外请求头
    await this.page.setExtraHTTPHeaders({
      'x-mat-from': 'puppeteer',
      'x-mat-timestamp': Date.now() + '',
    });

    // 设置设备
    if (this.pageDriver?.deviceConfig) {
      const deviceName = this.pageDriver.deviceConfig.name;
      const deviceeExtend = this.pageDriver.deviceConfig.extend || '';

      // https://github.com/puppeteer/puppeteer/blob/v4.0.0/docs/api.md#puppeteerdevices
      const curDeviceExtend = puppeteer.devices[deviceeExtend];
      if (curDeviceExtend) {
        this.pageDriver.deviceConfig.updateExtend(curDeviceExtend);
      }

      const curDevice = puppeteer.devices[deviceName];
      if (curDevice) {
        this.pageDriver.deviceConfig.updateExtend(curDevice);
      }

      await this.page.emulate(this.pageDriver.deviceConfig.getConfig());
    }

    // 设置 cookie
    if (this.pageDriver?.cookieConfig) {
      const temp: puppeteer.SetCookie[] = [];
      const arr = this.pageDriver.cookieConfig.getCookieObjectArr(this.pageDriver?.pageUrl);

      arr.forEach(item => {
        temp.push(item);
      });

      await this.page.setCookie(...temp);
    }

    // 如果有设置符合要求的 matman 服务设置，则还需要额外处理一下
    if (
      this.pageDriver?.mockstarQuery &&
      typeof this.pageDriver.mockstarQuery.appendToUrl === 'function'
    ) {
      this.pageDriver.pageUrl = this.pageDriver.mockstarQuery.appendToUrl(this.pageDriver.pageUrl);
    }

    this.emit('afterInitNightmareRun', {
      nightmare: this.page,
    });
  }

  async gotoPage(): Promise<void> {
    this.emit('beforeGotoPage', this.pageDriver?.pageUrl);

    if (!this.pageDriver?.pageUrl) {
      throw new Error('pageUrl must be defined');
    }

    await this.page?.goto(this.pageDriver?.pageUrl);

    // 兼容性处理
    if (
      typeof this.pageDriver?.waitFn === 'number' ||
      typeof this.pageDriver?.waitFn === 'string'
    ) {
      await this.page?.waitFor(this.pageDriver.waitFn as any);
    }
    // 函数执行结果给 waitFor
    if (typeof this.pageDriver?.waitFn === 'function') {
      await this.page?.waitFor(this.pageDriver.waitFn(...this.pageDriver.waitFnArgs) as any);
    }

    // 注入脚本
    if (typeof this.pageDriver.evaluateFn === 'string') {
      const res = await build(this.pageDriver.evaluateFn, {
        matmanConfig: this.pageDriver.matmanConfig,
      });
      this.page?.evaluate(res);
    }

    this.emit('afterGotoPage', {url: this.pageDriver?.pageUrl, page: this.page});
  }

  async runActions(stop?: number): Promise<any[]> {
    // 循环处理多个 action
    const result: any[] = [];
    // 触发开始事件
    this.emit('beforeRunActions', {index: 0, result: result});

    let i = 0;
    const actionList = this.pageDriver?.actionList as ((n: puppeteer.Page) => Promise<void>)[];
    const length = actionList.length;

    for (i; i < length; i++) {
      // 停止在某一步
      if (stop && i > stop) {
        break;
      }

      // 开始执行 action
      this.emit('beforeRunCase', {index: i, result: result});

      // 执行 action
      if (!this.page) {
        throw new Error('page must be defined');
      }
      await actionList[i](this.page);

      // 保存屏幕截图
      if (this.pageDriver?.screenshotConfig) {
        const screenshotFilePath = this.pageDriver.screenshotConfig.getPathWithId(i + 1);

        // 要保证这个目录存在，否则保存时会报错
        fs.ensureDirSync(path.dirname(screenshotFilePath));

        await this.page.screenshot({path: screenshotFilePath});
      }

      // 如果使用了记录器，则每个请求都延迟 50ms，注意是因为 network 是异步的
      // TODO 这里的处理过于粗暴，还可以优化
      // if (this.globalInfoRecorderKey) {
      //   curRun = curRun.wait(50);
      // }

      let t: any;
      if (typeof this.pageDriver?.evaluateFn === 'function') {
        t = await this.page.evaluate(this.pageDriver.evaluateFn, ...this.pageDriver.evaluateFnArgs);
      } else {
        t = await this.page.evaluate(evaluate);
      }

      // 覆盖率数据
      // if (t.__coverage__ && this.pageDriver.coverageConfig) {
      //   const coverageFilePath = this.pageDriver.coverageConfig.getPathWithId(i + 1);

      //   try {
      //     await fs.outputJson(coverageFilePath, t.__coverage__);

      //     // 设置存在的标志
      //     this.globalInfo.isExistCoverageReport = true;

      //     // 记录之后就删除之，否则返回的数据太大了
      //     delete t.__coverage__;
      //   } catch (e) {
      //     console.log('save coverage file fail', coverageFilePath, e);
      //   }
      // }

      result.push(t);

      // 结束执行 action
      this.emit('afterRunCase', {index: i, result: result});
    }

    this.emit('afterRunActions', {index: i, result: result});

    return result;
  }

  async cleanEffect(): Promise<void> {
    // 如果配置了不关闭界面，且当前是展示浏览器界面的场景，则不再自动关闭浏览器界面，以方便调试
    if (this.pageDriver?.doNotCloseBrowser && this.puppeteerConfig.headless === false) {
      console.log('do not close browser');
    } else {
      await this.browser?.close();
    }
  }

  async getResult() {
    await this.getConfig();

    await this.getNewInstance();

    await this.gotoPage();

    const result = await this.runActions();

    await this.cleanEffect();

    return {
      data: result,
      _dataIndexMap: this.pageDriver?._dataIndexMap,
      globalInfo: this.globalInfo,
    };
  }
}