const scriptConfig = require("./config/example.config.js");
const {
    clickContinueGame,
    actionsInCloudGameBallAndExit,
} = require("./share/migu.js");
const config = require("../config.js");

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

    async function main() {
        // 你的自动化逻辑...

        // 不要忘了签到领取云豆
        await actionsInCloudGameBallAndExit({ page, browser, log, sleep, tt });
    }

    log("开始自动化操作");
    // 原神启动
    await page.goto(scriptConfig.gameUrl);

    // 根据配置决定是否启动自动定时截图
    if (config.screenshots?.autoScreenshotEnabled !== false) {
        startAutoScreenshot();
    }
    // 游戏已经启动，点击继续游戏
    clickContinueGame(page);

    if (!config.isDev) {
        setTaskTimeout(
            scriptConfig.taskTimeoutMs > 0
                ? scriptConfig.taskTimeoutMs
                : undefined,
        );
        await main();
    }

    // 自动化完成后即可进入 REPL
    startRepl();
};
