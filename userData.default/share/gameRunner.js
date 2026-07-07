// ⚠️ 此文件在执行 init 或首次自动初始化时可能会被强制覆盖，请勿直接修改。
// 如需自定义脚本逻辑，请将 share/gameRunner.js 复制为新的文件（如 share/myGameRunner.js）

/**
 * @fileoverview 游戏启动/收尾通用流程共享库
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check
"use strict";

/// <reference path="../../autoGamer.d.ts" />

const { miguInit, actionsInCloudGameBallAndExit } = require("./migu.js");

// 模块作用域状态，供开发模式 REPL 中手动调用 mainFn
/**
 * @type {((...args: any[]) => any) | null}
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
 * @param {AutoGamer.ScriptCtx} ctx
 * @param {string} gameName 游戏名称
 * @param {any} scriptConfig 游戏配置（各脚本自定义结构）
 * @param {(...args: any[]) => any} mainFn 脚本定义的 main 异步函数
 * @param {AutoGamer.EvalFn} _eval 用于 REPL 中执行代码的 eval 函数
 */
async function runGame(ctx, gameName, scriptConfig, mainFn, _eval) {
    const {
        page,
        log,
        getGlobalConfig,
        createUtils,
        browser,
        getInstanceInfo,
    } = ctx;
    const { startAutoScreenshot, setTaskTimeout, startRepl } = createUtils(
        ctx,
        _eval,
    );
    const config = getGlobalConfig();
    const info = getInstanceInfo?.();

    // 存储 mainFn 供开发模式 REPL 使用
    _mainFn = mainFn;

    // 热重载路径：初始化已完成时直接启动 REPL，不再重复初始化和执行 mainFn
    if (info?.isHotReload) {
        log(`游戏：${gameName} (热重载)`);
        if (_initDone) {
            startRepl();
        } else {
            log(
                "WARNING: 热重载路径要求初始化已完成，但 _initDone 为 false，跳过 REPL",
            );
        }
        return;
    }
    if (_initDone) return;

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
        await browser.close();
        process.exit(1);
    }

    // 注册热重载清理函数：重置 mainFn 状态，保留 _initDone 和 page.on
    if (info) {
        info.cleanupFunctions.push(() => {
            _mainFn = null;
            _mainFnRunning = false;
            log("热重载清理：已重置 mainFn 状态");
        });
    }

    log(`游戏：${gameName}`);
    log("等待页面加载");

    // 如果游戏已经启动，点击继续游戏
    await miguInit(ctx);
    page.on("load", async () => {
        if (page.url() !== "about:blank") return;
        log("游戏已退出，程序退出");
        await browser.close();
        process.exit(0);
    });

    await page.goto(scriptConfig.gameUrl, config.pageloadOptions);

    // 根据配置决定是否启动自动定时截图
    if (config.screenshots?.autoScreenshotEnabled !== false) {
        startAutoScreenshot();
    }

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
        return;
    }

    // 开发模式：初始化完成后进入 REPL
    startRepl();
}

module.exports = { runGame, eMain: executeMainFn };
