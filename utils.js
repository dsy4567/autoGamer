const readline = require("readline");
const fs = require("fs");
const path = require("path");
const config = require("./config.js");

// 放在模块作用域，确保 createUtils 多次调用也只存在一个定时截图 timer
let _autoScreenshotTimer = null;
// 放在模块作用域，确保 createUtils 多次调用时节流和防并发状态全局共享
let _lastScreenshotTime = 0;
let _screenshotInProgress = false;
// 放在模块作用域，确保 createUtils 多次调用时任务超时定时器全局共享
let _taskTimer = null;

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
        const steps = config.automation?.defaultDragSteps ?? 20;
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
        log("输入 exit 退出 REPL");

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: "> ",
        });
        rl.prompt();
        rl.on("line", async input => {
            if (input.trim() === "exit") {
                rl.close();
                return;
            }
            if (input.trim() === "") {
                log("网页已打开毫秒数:", Date.now() - pageOpenTime);
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
                        config.screenshots?.screenshotThrottleMs ?? 2500,
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
    };
}

module.exports = { createUtils };
