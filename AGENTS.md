## 项目描述

> Warning: 此部分未经授权不得修改。

autoGamer 是一个基于 Puppeteer 的云游戏自动化工具，通过模拟触摸事件（tap/drag/hold等）驱动游戏操作，支持脚本化执行日常任务、自动截图和日志记录。

---

## 编码规范

### 日志使用

- 所有日志输出都必须通过 `log()`或 `logRaw()` 函数，不能直接使用 `console.log()`。
- info类日志无需标注级别，但是warning/error类日志内容必须包含日志级别（字符串以`WARNING:`、`ERROR:` 开头）。

### 解构规范

- 解构 `ctx` 或 `createUtils` 返回的对象时，必须写出所有可解构的属性，即使当前用不上。
- 目的：保证代码可读性，方便后续维护时直接引用已有变量，避免遗漏可用工具。

### 已废弃的脚本

-  如果文件名包含 `.deprecated`，则不允许编辑和使用。

---

## Agents 行为约束

暂无

---

## 避坑指南

> Note: 允许随时编辑`AGENTS.md`文件的此部分，以完善避坑指南。

### 1. 日志钩子与截图函数的递归调用

**场景**：`log()` 函数通过钩子 `_logScreenshot` 触发截图，截图函数内部又调用 `log()` 输出结果。

**现象**：程序运行后截图调用堆积，函数在预期时间内无法正常完成，事件循环被大量异步调用阻塞。

**根本原因**：形成递归调用链 `log() → _logScreenshot() → screenshot() → log("截图已保存:") → _logScreenshot() → ...`。虽然节流机制会在1秒后打断直接递归，但每次 `log()` 都产生一次 `screenshot()` 调用尝试，造成大量无效异步操作排队。

**错误示例**：

```js
// log 钩子无条件触发截图
_logScreenshot = args => {
    screenshot(label).catch(() => {});
};

// screenshot 内部调用 log，再次触发钩子
const screenshot = async (label = "") => {
    await page.screenshot({ path: filePath });
    log("截图已保存:", filename);  // ← 再次触发 _logScreenshot
};
```

**正确做法**：提供一个不触发截图钩子的 `logRaw` 函数，截图内部使用 `logRaw` 输出结果，打断递归链。

```js
// log 触发截图钩子
const log = (...args) => {
    console.log(...args);
    _logScreenshot(args);
};

// 原始日志，不触发截图钩子，供截图函数自身使用以避免递归
const logRaw = (...args) => {
    console.log(...args);
};

const screenshot = async (label = "") => {
    await page.screenshot({ path: filePath });
    logRaw("截图已保存:", filename);  // ← 使用 logRaw，不会再次触发 _logScreenshot
};
```

**预防措施**：

- 任何通过钩子/回调连接的双向调用链，必须在一侧设置明确的终止条件
- 设计钩子时考虑"自身输出是否会再次触发钩子"的问题
- 需要日志输出时，注意合理选择 `log()` 或 `logRaw()`，避免无限递归。

`***

### 2. 异步函数的并发节流失效

**场景**：`screenshot` 函数使用时间戳节流（1秒内限一张），但函数本身是 `async`，内部有 `await` 操作。

**现象**：多个 `screenshot()` 调用同时通过节流检查，导致多个 `page.screenshot()` 并发执行，争抢 CDP 连接。

**根本原因**：时间戳在函数入口更新，但 `await page.screenshot()` 期间其他调用也能通过节流检查（因为时间戳已经更新，间隔超过1秒），实际上多个截图操作同时在执行。

**错误示例**：

```js
const screenshot = async (label = "") => {
    if (now - _lastScreenshotTime < 1000) return;
    _lastScreenshotTime = now;       // 时间戳已更新
    await page.screenshot(...);      // 执行期间，其他调用可能也通过了节流检查
};
```

**正确做法**：增加进行中标志（互斥锁），防止并发执行。

```js
let _screenshotInProgress = false;

const screenshot = async (label = "") => {
    if (now - _lastScreenshotTime < 1000) return;
    if (_screenshotInProgress) return;   // 并发锁
    _screenshotInProgress = true;
    try {
        await page.screenshot(...);
    } finally {
        _screenshotInProgress = false;   // 确保异常时也释放
    }
};
```

**预防措施**：

- 对含 `await` 的异步函数，仅靠时间戳节流无法防止并发，必须配合互斥锁
- 异步函数中的锁必须放在 `try/finally` 中确保释放

***

### 3. 模块作用域 vs 函数作用域的状态变量

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

