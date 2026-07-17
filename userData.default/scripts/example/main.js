// ⚠️ 此文件在执行 init 或首次自动初始化时可能会被强制覆盖，请勿直接修改。
// 如需自定义脚本逻辑，请将整个 scripts/example/ 目录复制为新的 id（如 scripts/myExample/），在新目录修改并用新 id 运行：node index.js myExample

/**
 * @fileoverview 脚本 示例
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check
"use strict";

/// <reference path="../../autoGamer.d.ts" />

const loadScriptConfig = require("./config.default.js");
const { runGame, eMain } = require("../../share/gameRunner.js");

/**
 * @type {AutoGamer.ScriptFunction} ctx
 */
module.exports = async function (ctx) {
    // NOTE: 解构所有可解构的属性，即使未使用，以便在 REPL 中使用
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
        loadUserConfig,
        dataDir,
        scriptId,
        startAtChain,
        endAtChain,
        getInstanceInfo,
        enableHotReload,
    } = ctx;
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
        compareScreenshot,
        action,
        mi,
        setBeforeUnload,
    } = createUtils(ctx, (/** @type {string} */ code) => eval(code));
    const config = getGlobalConfig();
    const scriptConfig = loadScriptConfig(ctx);

    // 启用热重载功能，仅开发模式下生效，启用后只建议在脚本使用 action() 函数（而非 tt、drag 等函数）
    enableHotReload();

    async function main() {
        // ========== 你的自动化逻辑 ==========
        await action("点击某个位置", [["tt", 100, 100]]);
    }

    await runGame(ctx, "原神（示例脚本）", scriptConfig, main, code =>
        eval(code),
    );
};
