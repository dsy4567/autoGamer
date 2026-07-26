> Warning: 除了避坑指南，此文件其他部分未经授权不得修改。

## 项目描述

autoGamer 是一个基于 Puppeteer 的云游戏自动化工具，通过模拟触摸事件（tap/drag/hold等）驱动游戏操作，支持脚本化执行日常任务、自动截图和日志记录。

### 📁 目录结构
- `index.js`                          主入口
- `inject.js`                         注入脚本
- `utils.js`                          工具函数
- `config.default.js`                 全局默认配置
- `loadUserConfig.js`                 用户配置加载器（不存在时自动创建空配置）
- `jsconfig.json`                     TS 语言服务配置
- `<dataDir>/scripts/<id>/main.js`          脚本入口
- `<dataDir>/scripts/<id>/config.default.js` 脚本默认配置
- `<dataDir>/scriptData/<id>/config.js` 脚本用户配置（覆盖 scripts/<id>/config.default.js，运行时生成）
- `<dataDir>/logs/`            日志目录（按脚本 id 分子目录）
- `<dataDir>/share/*.js`       共享函数
- `<dataDir>/autoGamer.d.ts`   类型声明（供核心文件与 userData.default/ 下脚本消费）
- `<dataDir>/globalConfig.js`         全局用户配置（覆盖 config.default.js，运行时生成）

---

## 编码规范

### typing 规范

- 关键变量或函数应该包含 `@type` 或 `@param` 注释。
- 不允许忽略 typing lint error, 遇到修复结果困难/不优雅的情况，允许使用 `// @ts-ignore`、`any` 等，但在总结时必须说明原因。

### 日志使用

- 所有日志输出都必须通过 `log()`或 `logRaw()` 函数，不能直接使用 `console.log()`。
- info类日志无需标注级别，但是warning/error类日志内容必须包含日志级别（字符串以`WARNING:`、`ERROR:` 开头）。

### 解构规范
- 对于所有文件，解构 `ctx` 或 `createUtils` 返回的对象时，必须写出所有可解构的属性，即使未使用。
  - 这不适用于 `userData.default/share/` `userData.default/scripts/*/*.config.default.js` 目录下的文件，这里不应该包含未使用的属性。
- 目的：保证代码可读性，方便后续维护时直接引用已有变量，避免遗漏可用工具。

### 已废弃的脚本

-  如果文件名包含 `.deprecated`，则不允许编辑和使用。

---

## Agents 行为约束

### 排除文件

在没有明确说明的情况下，不要操作 `~/.autoGamer/` 目录下的文件。

### Git 提交规范

- 完成用户的编码任务后，第一步主动编写 git 提交信息，第二步询问用户是否需要直接提交，提交信息格式参考如下：
    ```text
    <符合 gitmoji 规范的 emoji 字符> <简要描述>

    - <对更改的详细说明>
    - ...
    ```
  - emoji 和简要描述间隔一个空格
  - 如果更改非常简单，允许不编写详细说明
  - 如果选择编写详细说明，注意包含空行和 markdown 无序列表
  - 使用简体中文

---

## 避坑指南

> Note: 允许随时编辑`AGENTS.md`文件的此部分，以完善避坑指南。

### 1. 修改代码签名时同步更新 autoGamer.d.ts

**场景**：修改核心文件（utils.js / index.js / config.default.js / loadUserConfig.js）或 `userData.default/share/*.js` 中的函数参数、返回值、导出对象结构时，仅改了实现而忘了更新类型声明。

**现象**：脚本作者依据过时的 `autoGamer.d.ts` 拿到错误的补全与类型检查结果，调用签名对不上实际实现，运行时抛错或行为异常；后续维护者难以判断是类型声明错还是实现错。

**根本原因**：`autoGamer.d.ts` 是手写维护的，与实现没有自动同步机制；编辑器只看类型声明，不会警告实现与声明不一致。

**正确做法**：每次改动涉及以下任一情况，都必须同步修改 `userData.default/autoGamer.d.ts`：
- 函数参数个数、类型、可选性
- 函数返回值类型（包括 Promise 包装）
- 导出对象/接口的属性增删
- `Operation` 元组、`Options` 接口等被脚本依赖的类型

**预防措施**：

- 把 `autoGamer.d.ts` 视作核心文件的"公共契约"，修改实现 = 修改契约
- 提交前检查一下被改动的函数名/属性名是否出现在 `autoGamer.d.ts`

***

### 2. 退出进程前必须先正常关闭浏览器

**场景**：脚本运行结束、捕获到致命错误、收到退出信号、游戏页面跳转到 `about:blank` 等需要结束进程的分支，直接调用 `process.exit()`。

**现象**：Chrome 进程残留、CDP 连接未正常断开、用户数据目录锁未释放，下一次启动可能因 `Profile` 锁占用而失败；日志/截图未完整落盘。

**根本原因**：`process.exit()` 立即终止 Node 进程，puppeteer 没有机会向 Chrome 发送关闭命令，Chrome 子进程成为孤儿。

**正确做法**：退出前 `await browser.close()` 再 `process.exit(code)`，即：

```js
await browser.close();
process.exit(0);
```

主入口 `index.js` 已封装 `_closeBrowserAndExit(code)` 工具函数，优先使用它；在脚本/共享函数中如需自行退出，也必须遵循"先关浏览器再退出"的顺序。

**预防措施**：

- 任何 `process.exit()` 调用前，确保 `await browser.close()` 已经完成（注意 `await` 不能漏）
- 捕获异常时也走关闭流程，可用 `try/finally` 保证浏览器被关闭

***

### 3. 使用 `===` 比较用户传参前先做类型转换

**场景**：用户配置或命令行参数虽然语义上是布尔/数字，但实际可能传入字符串、数字等可转换但类型不一致的值，代码用 `===` 严格比较导致判断失败。

**现象**：用户在配置文件里写 `forceRun: 1` 期望表示 `true`，代码中 `if (config.forceRun === true)` 不成立，逻辑被错误跳过；又如 `updateDates` 里写入数字 `20260707` 与字符串 `"20260707"` 比较。

**根本原因**：`===` 不做隐式类型转换，用户输入（来自 JSON / 命令行 / 表单）默认是字符串或弱类型，与代码中字面量类型不一致时严格相等比较直接返回 `false`。

**错误示例**：

```js
// 用户配置：{ forceRun: 1 }
if (config.forceRun === true) { ... }   // 不成立，分支不执行

// 用户配置：{ threshold: "0.9" }
if (options.threshold === 0.9) { ... }  // 不成立
```

**正确做法**：对"类型极可能非预期但可转换"的参数，先显式转换再比较：

```js
// 布尔型参数：使用 Boolean() 转换为布尔值
const forceRun = Boolean(config.forceRun);

// 数字型参数：先 Number() 再判断 NaN
const threshold = Number(options.threshold);
if (!Number.isNaN(threshold) && threshold >= 0.9) { ... }

// 日期/字符串：统一 String() 后比较
if (String(updateDate) === String(target)) { ... }
```

**预防措施**：

- 在 `config.default.js` / 各 `config.default.js` 加载用户配置后，统一做归一化处理（字符串→数字、弱布尔→强布尔）
- 自定义函数接收外部参数时，第一行先做类型归一化，再进入业务逻辑
- 仅在能保证类型一致的内部代码（如已归一化的变量之间）使用 `===`；边界处先转换再比较

***

### 4. 模块作用域 vs 函数作用域的状态变量

**场景**：`createUtils()` 可能被多次调用（不同脚本文件各自 `require("../utils.js")` 并调用 `createUtils(ctx)`）。

**现象**：如果节流时间戳和互斥锁放在 `createUtils` 函数内部，每次调用会创建新的变量实例，节流和防并发机制失效。

**根本原因**：`createUtils` 是工厂函数，内部变量是函数作用域的局部变量，每次调用独立。

**错误示例**：

```js
function createUtils(ctx) {
    let _lastScreenshotTime = 0;        // 每次调用都是新变量
    let _screenshotInProgress = false;   // 每次调用都是新变量
    // ...
}
```

**正确做法**：需要跨调用共享的状态变量放在模块作用域。

```js
// 模块作用域，确保 createUtils 多次调用时节流和防并发状态全局共享
let _lastScreenshotTime = 0;
let _screenshotInProgress = false;

function createUtils(ctx) {
    // 直接使用模块作用域的变量
}
```

**预防措施**：

- 注意区分"每次调用独立的状态"和"全局共享的状态"，例如
  - 全局共享状态（如节流时间戳、定时器、锁）放在模块作用域
  - 每次调用独立的状态 放在函数作用域
- 添加注释说明变量放在模块/函数作用域的原因

