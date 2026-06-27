const readline = require("readline");
const fs = require("fs");
const path = require("path");
const config = require("./config.default.js");

// 放在模块作用域，确保 createUtils 多次调用也只存在一个定时截图 timer
let _autoScreenshotTimer = null;
// 放在模块作用域，确保 createUtils 多次调用时节流和防并发状态全局共享
let _lastScreenshotTime = 0;
let _screenshotInProgress = false;
// 放在模块作用域，确保开发模式截图警告只输出一次
let _devScreenshotWarned = false;
// 放在模块作用域，确保 createUtils 多次调用时任务超时定时器全局共享
let _taskTimer = null;

// 放在模块作用域，确保 createUtils 多次调用时 action 的 start-at/end-at 状态全局共享
/** --start-at 解析后的描述链（null 表示未指定） @type {string[] | null} */
let _actionStartAtChain = null;
/** 当前已匹配到 start-at 链的第几个索引 */
let _actionStartAtIndex = 0;
/** 是否已到达 start-at 锚点 */
let _actionStartAtReached = false;
/** --end-at 解析后的描述链（null 表示未指定） @type {string[] | null} */
let _actionEndAtChain = null;
/** 当前已匹配到 end-at 链的第几个索引 */
let _actionEndAtIndex = 0;
/** 是否已到达 end-at 锚点 */
let _actionEndAtReached = false;
/** 是否已执行完 end-at 锚点 action，后续应全部跳过 */
let _actionEndAtPassed = false;
/** action 状态是否已完成初始化（仅从 process.argv 解析一次） */
let _actionStateInitialized = false;
/** action 调试模式是否开启 */
let _actionDbgEnabled = false;
/** 调试模式下挂起的 action 任务队列 @type {Array<{resolve: () => void, reject: (e: Error) => void, task: () => Promise<void>, description: string}>} */
let _actionDbgQueue = [];

/**
 * @param {{
 *   puppeteer: typeof import("puppeteer-core"),
 *   browser: import("puppeteer-core").Browser,
 *   page: import("puppeteer-core").Page,
 *   log: (...args: any[]) => void,
 *   logRaw: (...args: any[]) => void,
 *   pageOpenTime: number,
 *   logDir: string
 * }} ctx
 * @param {globalThis} that
 */
function createUtils(ctx, _eval = eval) {
    const { puppeteer, browser, page, log, logRaw, pageOpenTime, logDir } = ctx;

    /** 触摸开始 - 在指定坐标触发 touchStart 事件 @param {number} x 横坐标 @param {number} y 纵坐标 */
    const ts = (x, y) => page.touchscreen.touchStart(x, y);
    /** 触摸结束 - 触发 touchEnd 事件 */
    const te = () => page.touchscreen.touchEnd();
    /** 触摸移动 - 在指定坐标触发 touchMove 事件 @param {number} x 横坐标 @param {number} y 纵坐标 */
    const tm = (x, y) => page.touchscreen.touchMove(x, y);
    /** 触摸点击 - 在指定坐标触发 tap 事件 @param {number} x 横坐标 @param {number} y 纵坐标 */
    const tt = (x, y) => page.touchscreen.tap(x, y);
    /** 页面点击 - 调用 page.click @param {...any} args 传递给 page.click 的参数 */
    const pc = (...args) => page.click(...args);
    /** 长按 - 在指定坐标按下并保持一段时间后释放 @param {number} x 横坐标 @param {number} y 纵坐标 @param {number} [hold=100] 按住时长(毫秒) */
    const hold = async (x, y, hold = 100) => {
        await ts(x, y);
        await sleep(hold);
        await te();
    };
    /** 拖拽 - 从起点拖拽到终点，分步模拟触摸移动 @param {number} fromX 起点横坐标 @param {number} fromY 起点纵坐标 @param {number} toX 终点横坐标 @param {number} toY 终点纵坐标 @param {number} [duration=500] 拖拽持续时间(毫秒) */
    const drag = async (
        fromX,
        fromY,
        toX,
        toY,
        duration = config.automation?.defaultDragDuration ?? 500,
    ) => {
        const steps = duration / 22; // 45 fps
        const stepDuration = duration / steps;
        const stepX = (toX - fromX) / steps;
        const stepY = (toY - fromY) / steps;

        await ts(fromX, fromY);
        for (let i = 1; i <= steps; i++) {
            await sleep(stepDuration);
            await tm(fromX + stepX * i, fromY + stepY * i);
        }
        await te();
    };
    /** 延时等待 @param {number} ms 等待毫秒数 @returns {Promise<void>} */
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    /**
     * 执行一组自动化操作，自动处理日志、截图和流程控制（支持 --start-at / --end-at）
     * 特殊指令（不执行实际操作）：
     *   action('startAt', '描述#描述') / action('startAt', ['描述','描述']) — 覆盖 start-at 锚点
     *   action('endAt', '描述#描述')   / action('endAt', ['描述','描述'])   — 覆盖 end-at 锚点
     *   action('toggleDbg') — 开启/关闭调试模式（挂起后续 action，等待 next 逐步执行）
     *   action('next') — 调试模式下兑现下一个挂起的 action
     * @param {string} description 操作的简要描述，或特殊指令名
     * @param {Array<[string, ...any]> | string | string[]} [operations] 要依次执行的操作数组，或特殊指令参数
     * @returns {Promise<void>}
     */
    const action = async (description, operations) => {
        if (!_actionStateInitialized) {
            _actionStateInitialized = true;
            const parseFlag = flag => {
                const idx = process.argv.indexOf(flag);
                if (idx !== -1 && process.argv[idx + 1]) {
                    return process.argv[idx + 1].split("#");
                }
                return null;
            };
            _actionStartAtChain = parseFlag("--start-at");
            _actionEndAtChain = parseFlag("--end-at");
        }

        // 特殊指令：覆盖 start-at
        if (description === "startAt") {
            const chain =
                typeof operations === "string"
                    ? operations.split("#")
                    : Array.isArray(operations)
                      ? operations
                      : null;
            if (!chain) {
                log(
                    "WARNING: action startAt 参数无效，应为 string 或 string[]",
                );
                return;
            }
            _actionStartAtChain = chain;
            _actionStartAtIndex = 0;
            _actionStartAtReached = false;
            log(`action startAt 已覆盖: ${chain.join("#")}`);
            return;
        }

        // 特殊指令：覆盖 end-at
        if (description === "endAt") {
            const chain =
                typeof operations === "string"
                    ? operations.split("#")
                    : Array.isArray(operations)
                      ? operations
                      : null;
            if (!chain) {
                log("WARNING: action endAt 参数无效，应为 string 或 string[]");
                return;
            }
            _actionEndAtChain = chain;
            _actionEndAtIndex = 0;
            _actionEndAtReached = false;
            _actionEndAtPassed = false;
            log(`action endAt 已覆盖: ${chain.join("#")}`);
            return;
        }

        // 特殊指令：切换调试模式
        if (description === "toggleDbg") {
            _actionDbgEnabled = !_actionDbgEnabled;
            log(`action 调试模式: ${_actionDbgEnabled ? "开启" : "关闭"}`);
            if (!_actionDbgEnabled && _actionDbgQueue.length > 0) {
                log(
                    `action 调试模式关闭，自动兑现 ${_actionDbgQueue.length} 个挂起任务`,
                );
                const queue = _actionDbgQueue.splice(0, _actionDbgQueue.length);
                for (const {
                    resolve,
                    reject,
                    task,
                    description: taskDesc,
                } of queue) {
                    log(`action 调试兑现: ${taskDesc}`);
                    try {
                        await task();
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                }
            }
            return;
        }

        // 特殊指令：调试模式下执行下一个挂起的 action
        if (description === "next") {
            if (_actionDbgQueue.length === 0) {
                log("WARNING: action next 无挂起的调试任务");
                return;
            }
            const {
                resolve,
                reject,
                task,
                description: taskDesc,
            } = _actionDbgQueue.shift();
            log(`action next 执行: ${taskDesc}`);
            try {
                await task();
                resolve();
            } catch (e) {
                reject(e);
            }
            return;
        }

        // 特殊指令：调试模式下跳过下一个挂起的 action（直接 resolve，不执行操作）
        if (description === "skip") {
            if (_actionDbgQueue.length === 0) {
                log("WARNING: action skip 无挂起的调试任务");
                return;
            }
            const { resolve, description: taskDesc } = _actionDbgQueue.shift();
            log(`action skip 跳过: ${taskDesc}`);
            resolve();
            return;
        }

        if (description.includes("#")) {
            log(
                "WARNING: action 简要描述包含半角 # 字符，可能影响 --start-at / --end-at 的匹配结果",
            );
        }

        // --start-at：未到达锚点前跳过
        if (_actionStartAtChain && !_actionStartAtReached) {
            if (description === _actionStartAtChain[_actionStartAtIndex]) {
                _actionStartAtIndex++;
                if (_actionStartAtIndex === _actionStartAtChain.length) {
                    _actionStartAtReached = true;
                }
            }
            if (!_actionStartAtReached) {
                return;
            }
        }

        // --end-at：已越过锚点后跳过
        if (_actionEndAtPassed) {
            return;
        }

        // --end-at：推进匹配进度，若当前 action 恰好是锚点，执行完后标记越过
        let shouldPassAfterThis = false;
        if (_actionEndAtChain && !_actionEndAtReached) {
            if (description === _actionEndAtChain[_actionEndAtIndex]) {
                _actionEndAtIndex++;
                if (_actionEndAtIndex === _actionEndAtChain.length) {
                    _actionEndAtReached = true;
                    shouldPassAfterThis = true;
                }
            }
        }

        /** action 核心执行逻辑 */
        const _runActionCore = async () => {
            log(description);

            // 自动截图（迁移自 index.js 的 _logScreenshot 逻辑）
            if (config.screenshots?.screenshotOnLog !== false) {
                screenshot(description).catch(() => {});
            }

            for (const op of operations) {
                const [fnName, ...args] = op;
                const fn = { ts, te, tm, tt, pc, hold, sleep, drag }[fnName];
                if (!fn) {
                    log(`WARNING: action 中存在未知操作 "${fnName}"，已跳过`);
                    continue;
                }
                await fn(...args);
            }

            if (shouldPassAfterThis) {
                _actionEndAtPassed = true;
            }
        };

        if (_actionDbgEnabled) {
            log(`action 调试挂起: ${description}`);
            return new Promise((resolve, reject) => {
                _actionDbgQueue.push({
                    resolve,
                    reject,
                    task: _runActionCore,
                    description,
                });
            });
        }

        await _runActionCore();
    };

    /**
     * 启动实时测试 REPL，可在终端输入并执行 puppeteer 代码
     * 可用变量: browser, page, puppeteer, log 等
     * 输入 "exit" 退出 REPL 并关闭浏览器
     * @returns {Promise<void>}
     */
    async function startRepl() {
        await sleep(1000);
        log(
            "进入实时测试模式，可输入并执行 puppeteer 代码 (用 browser, page, puppeteer, log 等变量)",
        );
        log(
            "\n输入 exit 退出 REPL，使用 return 语句获取执行结果\n快捷命令: next / skip / tdbg\n确保网页获得焦点后可按住 alt+鼠标左键，发送 touch tap/drag/hold 事件",
        );

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: "> ",
        });
        rl.prompt();
        rl.on("line", async input => {
            const trimmed = input.trim();
            if (trimmed === "exit") {
                rl.close();
                return;
            }
            if (trimmed === "") {
                log("网页已打开毫秒数:", Date.now() - pageOpenTime);
                return;
            }
            if (trimmed === "next") {
                await action("next");
                rl.prompt();
                return;
            }
            if (trimmed === "skip") {
                await action("skip");
                rl.prompt();
                return;
            }
            if (trimmed === "tdbg") {
                await action("toggleDbg");
                rl.prompt();
                return;
            }
            try {
                // 允许访问 browser, page, puppeteer, log 及别名
                // 例外：允许使用 console.error 而不是 log/logRaw
                const result = await _eval(
                    `(async () => {try{${input}}catch(e){console.error(e)}})()`,
                );
                log("执行结果:", result);
            } catch (e) {
                log("ERROR:", e);
            }
            rl.prompt();
        }).on("close", async () => {
            log("REPL结束，关闭浏览器...");
            await screenshot("退出前").catch(() => {});
            await browser.close();
            process.exit(0);
        });
    }
    /** 根据游戏任务实际用时，设置任务超时，超时后自动关闭浏览器并退出进程，多次调用将重置超时 @param {number} [ms=1800000] 超时毫秒数，<=0时取消超时，默认30分钟 @returns {() => void} 取消超时的函数 */
    const setTaskTimeout = (
        ms = config.automation?.defaultTaskTimeoutMs ?? 30 * 60 * 1000,
    ) => {
        if (ms <= 0) {
            clearTimeout(_taskTimer);
            _taskTimer = null;
            return () => {};
        }
        if (_taskTimer) clearTimeout(_taskTimer);
        log(`设置任务超时: ${ms}ms`);
        _taskTimer = setTimeout(async () => {
            log(`WARNING: 任务超时(${ms}ms)，正在关闭浏览器...`);
            await screenshot("退出前").catch(() => {});
            try {
                await browser.close();
            } catch (e) {
                logRaw("ERROR: 关闭浏览器失败:", e);
            }
            process.exit(1);
        }, ms);
        return () => {
            clearTimeout(_taskTimer);
            _taskTimer = null;
        };
    };

    /** 截图并保存到日志目录，1秒内限一张 @param {string} [label=""] 截图标签/日志内容 */
    const screenshot = async (label = "") => {
        if (config.isDev && !_devScreenshotWarned) {
            _devScreenshotWarned = true;
            logRaw("WARNING: 开发模式下截图将写入项目临时目录:", logDir);
        }
        const now = Date.now();
        const throttleMs = config.screenshots?.screenshotThrottleMs ?? 2500;
        let msg = "";
        if (now - _lastScreenshotTime < throttleMs) msg = "截图失败: 触发节流";
        if (_screenshotInProgress) msg = "截图失败: 上一张截图正在处理中";
        if (msg) {
            logRaw(msg);
            throw new Error(msg);
        }
        let overlayWasVisible = false;
        _lastScreenshotTime = now;
        _screenshotInProgress = true;

        try {
            const timeStr = new Date().toISOString().replace(/[:.]/g, "-");
            const safeLabel = String(label)
                .replace(/[/\\?%*:|"<>\n\r\t]/g, "_")
                .substring(0, 80);
            const filename = safeLabel
                ? `${timeStr}_${safeLabel}.png`
                : `${timeStr}.png`;
            const filePath = path.join(logDir, filename);

            logRaw("准备截图");
            overlayWasVisible = await page.evaluate(() => {
                const el = document.getElementById("auto-gamer-overlay");
                if (!el) return false;
                const visible = el.style.getPropertyValue("display") !== "none";
                el.style.setProperty("display", "none", "important");
                return visible;
            });

            await Promise.race([
                page.screenshot({
                    path: filePath,
                    fullPage: false,
                    clip: {
                        x: 0,
                        y: 0,
                        width: config.viewport?.width ?? 640,
                        height: config.viewport?.height ?? 480,
                    },
                    captureBeyondViewport: false,
                    optimizeForSpeed: true,
                }),
                new Promise((resolve, reject) =>
                    setTimeout(
                        () => reject(new Error("截图超时")),
                        (config.screenshots?.screenshotThrottleMs ?? 2500) -
                            100,
                    ),
                ),
            ]);
            logRaw("截图已保存:", filename);
        } catch (e) {
            logRaw("截图失败:", e.message);
            throw e;
        } finally {
            try {
                await page.evaluate(wasVisible => {
                    const el = document.getElementById("auto-gamer-overlay");
                    if (el) {
                        el.style.setProperty(
                            "display",
                            wasVisible ? "block" : "none",
                            "important",
                        );
                    }
                }, overlayWasVisible);
            } catch (_) {}
            _screenshotInProgress = false;
        }
    };

    /** 启动每30秒自动截图 @param {number} [interval=30000] 间隔毫秒数 @returns {() => void} 停止定时器的函数 */
    const startAutoScreenshot = (
        interval = config.screenshots?.autoScreenshotInterval ?? 30000,
    ) => {
        if (_autoScreenshotTimer) clearInterval(_autoScreenshotTimer);
        _autoScreenshotTimer = setInterval(() => {
            screenshot("auto")
                .then(() => logRaw("自动截图成功"))
                .catch(() => {});
        }, interval);
        return () => {
            clearInterval(_autoScreenshotTimer);
            _autoScreenshotTimer = null;
            screenshot("退出前").catch(() => {});
        };
    };

    return {
        ts,
        te,
        tm,
        tt,
        pc,
        hold,
        sleep,
        startRepl,
        drag,
        setTaskTimeout,
        screenshot,
        startAutoScreenshot,
        action,
    };
}

module.exports = { createUtils };
