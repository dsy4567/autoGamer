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
    const { ts, te, tm, tt, pc, hold, sleep, drag, startRepl } = createUtils(ctx, code => eval(code));

    log("开始自动化操作");
    // 原神启动
    await page.goto(
        "https://www.migufun.com/miguplay/middleGame/gameplay/400007864?gameName=%E5%8E%9F%E7%A5%9E%C2%B7%E7%A9%BA%E6%9C%88%E4%B9%8B%E6%AD%8C"
    );
    // 你的自动化逻辑...

    // 自动化完成后即可进入 REPL
    startRepl();
};
