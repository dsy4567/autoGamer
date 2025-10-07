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

    const ts = (x, y) => page.touchscreen.touchStart(x, y);
    const te = () => page.touchscreen.touchEnd();
    const tm = (x, y) => page.touchscreen.touchMove(x, y);
    const tt = (x, y) => page.touchscreen.tap(x, y);
    const pc = (...args) => page.click(...args);
    const hold = async (x, y, hold = 100) => {
        await ts(x, y);
        await sleep(hold);
        await te();
    };
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
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // 实时测试 REPL
    async function startRepl() {
        log(
            "进入实时测试模式，可输入并执行 puppeteer 代码 (用 browser, page, puppeteer, log 等变量)"
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
                    `(async () => {try{${input}}catch(e){console.error(e)}})()`
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
    return { ts, te, tm, tt, pc, hold, sleep, startRepl, drag };
}

module.exports = { createUtils };
