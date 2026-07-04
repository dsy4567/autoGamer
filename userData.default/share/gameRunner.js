// userData.default/share/gameRunner.js
// 游戏启动/收尾通用流程共享库
// 所有游戏脚本通过调用此函数完成页面跳转、miguInit、main执行、签到退出、REPL 等通用流程
/// <reference path="../autoGamer.d.ts" />

const { miguInit, actionsInCloudGameBallAndExit } = require("./migu.js");

// 模块作用域状态，供开发模式 REPL 中手动调用 mainFn
/**
 * @type {Function | null}
 */
let _mainFn = null;
let _mainFnRunning = false;
let _initDone = false;

/**
 * 手动执行 mainFn，供开发模式 REPL 使用
 * 会检查初始化是否完成、是否有正在执行的 mainFn，异常情况仅打日志不抛错
 */
async function executeMainFn() {
    if (!_mainFn) {
        console.log("WARNING: executeMainFn: mainFn 未设置");
        return;
    }
    if (!_initDone) {
        console.log(
            "WARNING: executeMainFn: 初始化尚未完成，请等待页面加载和 miguInit 完成后再试",
        );
        return;
    }
    if (_mainFnRunning) {
        console.log(
            "WARNING: executeMainFn: mainFn 正在执行中，请等待当前执行完成",
        );
        return;
    }
    _mainFnRunning = true;
    try {
        await _mainFn();
    } catch (e) {
        console.log(`ERROR: executeMainFn: mainFn 执行出错 - ${e}`);
    } finally {
        _mainFnRunning = false;
    }
}

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
 * @param {Pick<AutoGamer.ScriptCtx, "puppeteer" | "browser" | "page" | "log" | "logRaw" | "pageOpenTime" | "logDir" | "getGlobalConfig" | "createUtils">} ctx
 * @param {string} gameName 游戏名称
 * @param {any} scriptConfig 游戏配置（各脚本自定义结构）
 * @param {Function} mainFn 脚本定义的 main 异步函数
 * @param {AutoGamer.EvalFn} _eval 用于 REPL 中执行代码的 eval 函数
 */
async function runGame(ctx, gameName, scriptConfig, mainFn, _eval) {
    const { page, log, getGlobalConfig, createUtils } = ctx;
    const { startAutoScreenshot, setTaskTimeout, startRepl } = createUtils(
        ctx,
        _eval,
    );
    const config = getGlobalConfig();

    // 存储 mainFn 供开发模式 REPL 使用
    _mainFn = mainFn;

    // 检查是否为游戏版本更新日
    const updateDate = checkUpdateDate(scriptConfig.updateDates);
    const forceRun =
        config.forceRun === true || process.argv.includes("--force-run");
    if (updateDate && !forceRun) {
        log(`ERROR: 版本更新后24小时内无法运行脚本

当前处于 ${gameName} 版本更新后24小时保护期内（更新时间：${updateDate}）
请阅读数据目录下的 README.md 并手动进入游戏完成必要事项：
 - 同意新用户协议
 - 处理可能影响脚本运行的弹窗和活动
完成后可使用以下方式强制运行脚本：
  - 或在全局配置中设置: forceRun: true
  - 或在命令行中添加参数: --force-run
注意监控程序是否操作异常
  `);
        process.exit(1);
    }

    log(`游戏：${gameName}`);
    log("等待页面加载");
    await page.goto(scriptConfig.gameUrl, config.pageloadOptions);
    page.on("load", () => {
        if (page.url() !== "about:blank") return;
        log("游戏已退出，程序退出");
        process.exit(0);
    });

    // 根据配置决定是否启动自动定时截图
    if (config.screenshots?.autoScreenshotEnabled !== false) {
        startAutoScreenshot();
    }

    // 如果游戏已经启动，点击继续游戏
    await miguInit(ctx);

    // 初始化完成，标记状态供 executeMainFn 检查
    _initDone = true;

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

module.exports = { runGame, eMain: executeMainFn };
