const readline = require("readline");

/**
 * @param {{
 *   puppeteer: typeof import("puppeteer-core"),
 *   browser: import("puppeteer-core").Browser,
 *   page: import("puppeteer-core").Page,
 *   log: (...args: any[]) => void,
 *   pageOpenTime: number
 * }} ctx
 * @param {globalThis} that
 */
function createUtils(ctx, _eval = eval) {
    const { puppeteer, browser, page, log, pageOpenTime } = ctx;

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
    const drag = async (fromX, fromY, toX, toY, duration = 500) => {
        const steps = 20;
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
                const result = await _eval(
                    `(async () => {try{${input}}catch(e){console.error(e)}})()`,
                );
                log("执行结果:", result);
            } catch (e) {
                log("错误:", e);
            }
            rl.prompt();
        }).on("close", async () => {
            log("REPL结束，关闭浏览器...");
            await browser.close();
            process.exit(0);
        });
    }
    let _taskTimer = null;
    /** 设置任务超时，超时后自动关闭浏览器并退出进程 @param {number} [ms=1800000] 超时毫秒数，默认30分钟 @returns {() => void} 取消超时的函数 */
    const setTaskTimeout = (ms = 30 * 60 * 1000) => {
        if (_taskTimer) clearTimeout(_taskTimer);
        _taskTimer = setTimeout(async () => {
            log(`任务超时(${ms}ms)，正在关闭浏览器...`);
            try {
                await browser.close();
            } catch (e) {
                console.error(e);
            }
            process.exit(1);
        }, ms);
        return () => {
            clearTimeout(_taskTimer);
            _taskTimer = null;
        };
    };

    return { ts, te, tm, tt, pc, hold, sleep, startRepl, drag, setTaskTimeout };
}

module.exports = { createUtils };
