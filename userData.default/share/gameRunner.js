// userData.default/share/gameRunner.js
// 游戏启动/收尾通用流程共享库
// 所有游戏脚本通过调用此函数完成页面跳转、miguInit、main执行、签到退出、REPL 等通用流程

const { miguInit, actionsInCloudGameBallAndExit } = require("./migu.js");

/**
 * 检查当前时间是否在版本更新后的24小时内
 * @param {string[]} updateDates 更新时间数组，ISO 8601 格式（如 "2026-07-15T06:00:00+08:00"）
 * @returns {string|null} 匹配的时间字符串，无匹配返回 null
 */
function checkUpdateDate(updateDates) {
    if (
        !updateDates ||
        !Array.isArray(updateDates) ||
        updateDates.length === 0
    ) {
        return null;
    }
    const now = Date.now();
    for (const dateStr of updateDates) {
        const updateTime = new Date(dateStr).getTime();
        if (isNaN(updateTime)) continue;
        // 在配置时间点之后的24小时内拒绝运行
        if (now >= updateTime && now < updateTime + 24 * 60 * 60 * 1000) {
            return dateStr;
        }
    }
    return null;
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
 *   getGlobalConfig: () => typeof import("../../../config.default.js"),
 *   createUtils: () => typeof import("../../../utils.js").createUtils,
 *   loadUserConfig: typeof import("../../../loadUserConfig.js")
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
        log(`ERROR: 版本更新后24小时内无法运行脚本

当前处于 ${gameName} 版本更新后24小时保护期内（更新时间：${updateDate}）
请阅读数据目录下的 README.md 并手动进入游戏完成必要事项：
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
                ? scriptConfig.taskTimeoutMs +
                      (scriptConfig.dungeonFightTimeout ?? 0) *
                          (scriptConfig.dungeonRunCount ?? 0)
                : undefined,
        );
        await mainFn();
        await actionsInCloudGameBallAndExit(ctx);
    }

    // 自动化完成后即可进入 REPL
    startRepl();
}

module.exports = { runGame };
