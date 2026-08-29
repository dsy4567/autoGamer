// ⚠️ 此文件在执行 init 或首次自动初始化时可能会被强制覆盖，请勿直接修改。
// 如需自定义配置，请编辑 <数据目录>/scriptData/mgqd/config.override.js

/**
 * @fileoverview 脚本 咪咕签到 的默认配置及加载用户自定义配置
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check
"use strict";

/// <reference path="../../autoGamer.d.ts" />

const path = require("path");

/**
 * @param {AutoGamer.ScriptConfigCtx} ctx
 */
module.exports = function (ctx) {
    const { loadUserConfig, scriptDataDir } = ctx;
    const userConfig = loadUserConfig(
        path.join(scriptDataDir, "config.override.js"),
        ctx,
    );

    /**
     * @type {{
     *   taskTimeoutMs: number,
     * }}
     */
    const defaultConfig = {
        // 任务超时时间（毫秒），0 表示使用全局默认
        taskTimeoutMs: 2 * 60 * 1000,
    };

    return { ...defaultConfig, ...userConfig };
};
