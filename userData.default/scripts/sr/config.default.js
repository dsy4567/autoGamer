// ⚠️ 此文件在执行 init 或首次自动初始化时可能会被强制覆盖，请勿直接修改。
// 如需自定义配置，请编辑 <数据目录>/scriptData/sr/config.js

/**
 * @fileoverview 脚本 崩坏：星穹铁道 的默认配置及加载用户自定义配置
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
    const { loadUserConfig, dataDir, scriptId } = ctx;
    const userConfig = loadUserConfig(
        path.join(dataDir, "scriptData", scriptId, "config.js"),
        ctx,
    );

    /**
     * @type {{
     *   updateDates: string[],
     *   gameUrl: string,
     *   taskTimeoutMs: number,
     *   dungeonType: number,
     *   dungeonFightTimeout: number,
     *   startupDelays: {
     *     initialWait: number,
     *     afterStartGame: number,
     *   },
     *   dungeonRunCount: number,
     * }}
     */
    const defaultConfig = {
        /** 版本更新时间列表，ISO 8601 格式（如 "2026-07-15T06:00:00+08:00"），更新后24h内拒绝运行 */
        updateDates: ["2026-07-15T06:00:00+08:00"],
        /** 游戏启动 URL（咪咕快游平台） */
        gameUrl:
            "https://www.migufun.com/miguplay/middleGame/gameplay/400803874?gameName=%E5%B4%A9%E5%9D%8F%EF%BC%9A%E6%98%9F%E7%A9%B9%E9%93%81%E9%81%93",
        /** 基础任务超时时间（毫秒），默认 15 分钟，会额外增加刷本次数*副本预计战斗时长 */
        taskTimeoutMs: 15 * 60 * 1000,
        /** 副本预计战斗时长（毫秒） */
        dungeonFightTimeout: 15 * 60 * 1000,
        /** 启动阶段延时配置（毫秒） */
        startupDelays: {
            /** 等待页面初始加载 */
            initialWait: 40 * 1000,
            /** 同意用户协议后等待，并检测场景变化 */
            // afterAgreement: 10 * 1000,
            /** 点击开始游戏后等待读条 */
            afterStartGame: 30 * 1000,
        },
        /** 副本运行次数 */
        dungeonRunCount: 1,
        /** 副本类型: 1=经验书, 2=武器矿, 3=钞票, 4=培养目标首个副本 */
        dungeonType: 1,
    };

    return { ...defaultConfig, ...userConfig };
};
