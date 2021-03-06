# 安装和升级

在使用 matman 来构建项目之前，需要先安装 Node 和 [matman-cli](https://www.npmjs.com/package/matman-cli) 。

## 1. 安装 Node.js 并验证版本

### 1.1 Node.js 安装

matman 是基于 Node.js 来实现的，因此需要在本机安装 [Node.js](https://nodejs.org/)，可以选择：

- 进入 [https://nodejs.org/](https://nodejs.org/) 官网，选择 LTS 版本的 Node 安装
- 采用 [NVM](https://github.com/nvm-sh/nvm) 进行多版本管理

### 1.2 版本验证

完成安装后，执行下面命令，查看当前 Node 版本：

```
$ node -v
```

- 如果能正常输出 Node 的版本号，表示 Node 已安装成功（ Windows 系统可能需要重新打开 cmd）
- 值得注意的是，一定要确保 Node.js 版本在 `10.18.1` 及以上，否则将无法运行

## 2. 安装 matman-cli

[matman-cli](https://www.npmjs.com/package/matman-cli) 提供了一些命令行，用于初始化项目和构建等。

Node 安装成功后，执行如下 npm 命令安装 matman-cli （Mac 或 Linux 的非 `root` 用户需要在命令行前面加 `sudo`，如：`sudo npm install -g matman-cli`）。

```
$ npm install -g matman-cli
```

npm 默认镜像是在国外，有时候安装速度很慢或者出现安装不了的情况，如果无法安装或者安装很慢，可以使用淘宝的镜像安装：

```
$ npm install -g cnpm --registry=https://registry.npm.taobao.org
$ cnpm install -g matman-cli
```

或者直接指定镜像安装：

```
$ npm install -g matman-cli --registry=https://registry.npm.taobao.org
```

全局安装 matman-cli 时，如果遇到 electron 安装权限问题，则需要增加一些额外参数来安装，原因可以查看 [#30](https://github.com/matmanjs/matman-cli/issues/30)：

```
$ npm install matman-cli -g --unsafe-perm=true --allow-root
```

matman-cli 安装完成后，执行命令 `matman --help`，查看帮助信息:

```
$ matman --help

  Usage: matman [options] [command]


  Commands:
      build                                    Build the code.


  Options:
      --version, -[v]           Print version and exit successfully.
      --help, -[h]              Print this help and exit successfully.


  Report bugs to https://github.com/matmanjs/matman/issues.
```

如果能正常输出 matman 的帮助信息，表示已安装成功。

## 3. 升级 matman-cli

> 为了能使用 matman 的所有功能，请记得将其升级到最新版本。

升级命令与安装命令类似，请参考上一节内容。