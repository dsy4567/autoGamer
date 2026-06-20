const scriptConfig = require("./config/example.config.js");

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
 */
module.exports = async function (ctx) {
    const { puppeteer, browser, page, log, logRaw, pageOpenTime, logDir } = ctx;
    const { createUtils } = require("../utils.js");
    const {
        ts,
        te,
        tm,
        tt,
        pc,
        hold,
        sleep,
        drag,
        screenshot,
        startAutoScreenshot,
        startRepl,
        setTaskTimeout,
    } = createUtils(ctx, code => eval(code));

    log("开始自动化操作");
    // 原神启动
    await page.goto(scriptConfig.gameUrl);
    if (scriptConfig.taskTimeoutMs > 0) {
        setTaskTimeout(scriptConfig.taskTimeoutMs);
    } else {
        setTaskTimeout();
    }

    // 你的自动化逻辑...

    // 自动化完成后即可进入 REPL
    startRepl();
};
