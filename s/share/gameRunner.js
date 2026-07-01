// s/share/gameRunner.js
// 游戏启动/收尾通用流程共享库
// 所有游戏脚本通过调用此函数完成页面跳转、miguInit、main执行、签到退出、REPL 等通用流程

const { miguInit, actionsInCloudGameBallAndExit } = require("./migu.js");

/**
 * @param {{
 *   puppeteer: typeof import("puppeteer-core"),
 *   browser: import("puppeteer-core").Browser,
 *   page: import("puppeteer-core").Page,
 *   log: (...args: any[]) => void,
 *   logRaw: (...args: any[]) => void,
 *   pageOpenTime: number,
 *   logDir: string,
 *   getGlobalConfig: () => any,
 *   createUtils: () => typeof import("../../utils.js").createUtils
 * }} ctx
 * @param {string} gameName 游戏名称
 * @param {object} scriptConfig 游戏配置
 * @param {Function} mainFn 脚本定义的 main 异步函数
 */
async function runGame(ctx, gameName, scriptConfig, mainFn, _eval) {
    const {
        puppeteer,
        browser,
        page,
        log,
        logRaw,
        pageOpenTime,
        logDir,
        getGlobalConfig,
        createUtils,
    } = ctx;
    const { startAutoScreenshot, setTaskTimeout, startRepl } = createUtils(
        ctx,
        _eval,
    );
    const config = getGlobalConfig();

    log(`游戏：${gameName}`);
    log("等待页面加载");
    await page.goto(scriptConfig.gameUrl);

    // 根据配置决定是否启动自动定时截图
    if (config.screenshots?.autoScreenshotEnabled !== false) {
        startAutoScreenshot();
    }

    // 如果游戏已经启动，点击继续游戏
    await miguInit(ctx);

    if (!config.isDev) {
        setTaskTimeout(
            scriptConfig.taskTimeoutMs > 0
                ? scriptConfig.taskTimeoutMs
                : undefined,
        );
        await mainFn();
        await actionsInCloudGameBallAndExit(ctx);
    }

    // 自动化完成后即可进入 REPL
    startRepl();
}

module.exports = { runGame };
