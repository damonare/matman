import fs from 'fs';
import path from 'path';
import _ from 'lodash';

import MatmanConfig from '../config/MatmanConfig';
import {MATMAN_CONFIG_FILE} from '../config';
import {MatmanConfigOpts} from '../types';
import {requireSync} from './require-file';

/**
 * 获得绝对路径地址
 *
 * @param targetPath 目标路径
 * @param basePath 根路径，如果目标路径为相对路径，则将用该路径作为其根路径
 */
export function getAbsolutePath(targetPath: string, basePath?: string): string {
  if (!targetPath) {
    return '';
  }

  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  return basePath ? path.resolve(basePath, targetPath) : path.resolve(targetPath);
}

/**
 * 从指定目录开始向上查找 config 配置文件。
 *
 * @param {String} fromCwd 起始搜索的目录
 * @param {String} fileName 需要搜索的文件
 * @return {String}
 */
export function searchFilePath(fromCwd: string, fileName: string): string {
  // 非法的路径时，默认为本文件夹的 dirname
  if (!fromCwd || !fs.existsSync(fromCwd)) {
    // console.log('Unknow configPath=' + configPath);
    fromCwd = __dirname;
  }

  // 如果不是 config file，则从当前路径往上找 config file
  if (fromCwd.indexOf(fileName) < 0) {
    const result = _search(fromCwd, fileName);

    // 如果没有找到，则直接返回空路径即可
    if (!result) {
      return '';
    }

    fromCwd = path.resolve(result, fileName);
  }

  return fromCwd;
}

/**
 * 通过某个路径一直往上找，直到找到 matman.config.js 文件为止，并返回 matmanConfig 对象
 *
 * @param {String} basePath 起始路径
 * @param {Object} [matmanConfigOpts] 额外传递给 MatmanConfig 的参数，可覆盖 matman.config.js 中配置内容
 * @return {null | MatmanConfig}
 */
export function findMatmanConfig(
  basePath: string,
  matmanConfigOpts?: MatmanConfigOpts,
): null | MatmanConfig {
  let configData: MatmanConfigOpts = {};

  // matman 所需要的配置数据有两个来源，优先级依次降低
  // 1. 通过 MatmanConfigOpts 直接传递数据
  // 2. 使用 matman.config.js 文件，我们自行读取

  // 获取 rootPath，优先级：matmanConfigOpts > matman.config.js 中的定义 > matman.config.js 目录 > package.json 目录

  // 尝试获得 matman.config.js 文件
  const matmanConfigFilePath = searchFilePath(basePath, MATMAN_CONFIG_FILE);

  // 如果查到这个配置文件，则使用之
  if (matmanConfigFilePath) {
    // 获取 matman.config.js 中的配置内容
    const res = requireSync(matmanConfigFilePath);

    // matmanConfigOpts 的优先级要高于 matman.config.js 中的配置内容
    configData = _.merge({}, res, matmanConfigOpts);
  }

  // 获取 rootPath，优先级：matmanConfigOpts > matman.config.js 中的定义 > matman.config.js 目录 > package.json 目录
  // 如果 rootPath 不存在，则需要自动计算
  if (!configData.rootPath || !fs.existsSync(configData.rootPath)) {
    if (matmanConfigFilePath) {
      // 如果存在 matman.config.js 文件，则取该文件目录
      configData.rootPath = path.dirname(matmanConfigFilePath);
    } else {
      // 否则获取 package.json 目录
      const packageFilePath = searchFilePath(basePath, 'package.json');
      if (!packageFilePath) {
        // 如果连 package.json 都找不到，直接报错吧
        return null;
      } else {
        configData.rootPath = path.dirname(packageFilePath);
      }
    }
  }

  try {
    // 根据配置内容获得 matmanConfig 的对象
    if (!configData.rootPath) {
      throw new Error('rootPath must be defined');
    }

    return new MatmanConfig(configData.rootPath, configData);
  } catch (err) {
    console.error((err && err.message) || err);
    return null;
  }
}

/**
 * 在指定的路径中，获得配置文件的路径。
 *
 * 寻找的规则：从指定的路径开始，依次往上级目录查找，一直到根目录为止，如果找到，则停止。
 *
 * @param {String} fromCwd 起始搜索的目录
 * @param {String} fileName 需要搜索的文件
 * @return {String}
 */
function _search(fromCwd: string, fileName: string): string {
  let currDir = fromCwd || process.cwd();
  let isExist = true;

  while (!fs.existsSync(path.resolve(currDir, fileName))) {
    currDir = path.resolve(currDir, '../');

    // unix跟目录为/， win32系统根目录为 C:\\格式的
    if (currDir === '/' || /^[a-zA-Z]:\\$/.test(currDir)) {
      isExist = false;
      // console.log('未找到 ' + fileName);
      break;
    }
  }

  return isExist ? currDir : '';
}
