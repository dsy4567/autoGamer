// s/share/gameRunner.js
// 游戏启动/收尾通用流程共享库
// 所有游戏脚本通过调用此函数完成页面跳转、miguInit、main执行、签到退出、REPL 等通用流程

const { miguInit, actionsInCloudGameBallAndExit } = require("./migu.js");

/**
 * 检查当前日期是否为游戏版本更新日
 * @param {string[]} updateDates 更新日期数组，格式 "YYYY-MM-DD"
 * @returns {string|null} 匹配的日期字符串，无匹配返回 null
 */
function checkUpdateDate(updateDates) {
    if (
        !updateDates ||
        !Array.isArray(updateDates) ||
        updateDates.length === 0
    ) {
        return null;
    }
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    return updateDates.includes(today) ? today : null;
}

/**
 * @param {{
 *   puppeteer: typeof import("puppeteer-core"),
 *   browser: import("puppeteer-core").Browser,
 *   page: import("puppeteer-core").Page,
 *   log: (...args: any[]) => void,
 *   logRaw: (...args: any[]) => void,
 *   pageOpenTime: number,
 *   logDir: string,
 *   getGlobalConfig: () => typeof import("../../config.default.js"),
 *   createUtils: () => typeof import("../../utils.js").createUtils
 * }} ctx
 * @param {string} gameName 游戏名称
 * @param {object} scriptConfig 游戏配置
 * @param {Function} mainFn 脚本定义的 main 异步函数
 */
async function runGame(ctx, gameName, scriptConfig, mainFn, _eval) {
    const { page, log, getGlobalConfig, createUtils } = ctx;
    const { startAutoScreenshot, setTaskTimeout, startRepl } = createUtils(
        ctx,
        _eval,
    );
    const config = getGlobalConfig();

    // 检查是否为游戏版本更新日
    const updateDate = checkUpdateDate(scriptConfig.updateDates);
    const forceRun =
        process.env.AUTOGAMER_FORCE === "1" || config.forceRun === true;
    if (updateDate && !forceRun) {
        log(`ERROR: 游戏版本更新日当天无法运行脚本

今日 (${updateDate}) 为 ${gameName} 版本更新日
请阅读 s/README.md 并手动进入游戏完成必要事项：
 - 同意新用户协议
 - 处理可能影响脚本运行的弹窗和活动
完成后可使用以下方式强制运行脚本：
  - 设置环境变量: AUTOGAMER_FORCE=1
  - 或在全局配置中设置: forceRun: true
注意监控程序是否操作异常
  `);
        process.exit(1);
    }

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
