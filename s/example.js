const readline = require("readline");

/**
 * @param {{
 *   puppeteer: typeof import("puppeteer-core"),
 *   browser: import("puppeteer-core").Browser,
 *   page: import("puppeteer-core").Page,
 *   log: (...args: any[]) => void,
 *   pageOpenTime: number
 * }} ctx
 */
module.exports = async function (ctx) {
    const { puppeteer, browser, page, log, pageOpenTime } = ctx;
    const { createUtils } = require("../utils.js");
    const { ts, te, tm, tt, pc, hold, sleep, drag } = createUtils(ctx);

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
                const result = await eval(
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

    log("开始自动化操作");
    // 原神启动
    await page.goto(
        "https://www.migufun.com/miguplay/middleGame/gameplay/400007864?gameName=%E5%8E%9F%E7%A5%9E%C2%B7%E7%A9%BA%E6%9C%88%E4%B9%8B%E6%AD%8C"
    );
    // 你的自动化逻辑...

    // 自动化完成后即可进入 REPL
    startRepl();
};
