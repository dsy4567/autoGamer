// ⚠️ 此文件在执行 init 或首次自动初始化时可能会被强制覆盖，请勿直接修改。
// 如需自定义配置，请编辑 <数据目录>/scriptData/zzz/config.js

/**
 * @fileoverview 脚本 绝区零 的默认配置及加载用户自定义配置
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
     *   startupDelays: {
     *     initialWait: number,
     *     afterStartGame: number,
     *   },
     *   coffeeIndex: 0 | 1 | 2 | 3 | 4,
     *   selectPromoterActions: AutoGamer.Operation[],
     *   customCardGroupSpacingOffset: [number, number],
     *   customCardGroupSpacing: number,
     *   manualInterventionDelay: number,
     *   coffeeShopInterventionDelay: number,
     *   magazineShopInterventionDelay: number,
     *   dungeonFightTimeout: number,
     *   customTemplateIndex: 0 | 1 | 2 | 3 | 4,
     *   dungeonRunCount: number,
     *   customFightActions: any[],
     * }}
     */
    const defaultConfig = {
        /** 版本更新时间列表，ISO 8601 格式（如 "2026-07-29T06:00:00+08:00"），更新后24h内拒绝运行 */
        updateDates: ["2026-07-29T06:00:00+08:00"],
        /** 游戏启动 URL（咪咕快游平台） */
        gameUrl:
            "https://www.migufun.com/miguplay/middleGame/gameplay/400883911?gameName=%E7%BB%9D%E5%8C%BA%E9%9B%B6",
        /** 基础任务超时时间（毫秒），默认 15 分钟，会额外增加刷本次数*副本预计战斗时长 */
        taskTimeoutMs: 15 * 60 * 1000,
        /** 启动阶段延时配置（毫秒） */
        startupDelays: {
            /** 等待页面 初始加载 */
            initialWait: 40 * 1000,
            /** 点击开始游戏后等待读条 */
            afterStartGame: 20 * 1000,
        },
        /** 材料本-自定义模板序号，从0开始计数，范围 [0, 4]，默认浓缩咖啡 */
        coffeeIndex: 1,
        /** 录像店-邦布-选择宣传员，要选择的宣传员坐标，默认第一个即邦布 */
        selectPromoterActions: [["tt", 205, 175]],
        /** customCardGroupSpacing 偏移量，单位像素 */
        customCardGroupSpacingOffset: [85, 330],
        /** 自定义卡组选项的间隔，单位像素 */
        customCardGroupSpacing: 115,
        /** 进入副本前预留人工干预时间（毫秒） */
        manualInterventionDelay: 0,
        /** 咖啡店操作完成后预留人工干预时间（毫秒） */
        coffeeShopInterventionDelay: 0,
        /** 报刊亭操作完成后预留人工干预时间（毫秒） */
        magazineShopInterventionDelay: 0,
        /** 副本预计战斗时长（毫秒） */
        dungeonFightTimeout: 10 * 60 * 1000,
        /** 材料本-自定义模板序号，从0开始计数，范围 [0, 4] */
        customTemplateIndex: 0,
        /** 刷本次数，默认 3 次 */
        dungeonRunCount: 3,
        /** 自定义副本打怪操作，推荐操作总时长接近小于 5000 毫秒 */
        // WARN: 别用下面没列出的坐标，像素值也不要碰，别问为什么
        customFightActions: [
            ["tt", 445, 424], // 技能*3
            ["sleep", 50],
            ["tt", 445, 424],
            ["sleep", 50],
            ["tt", 445, 424],
            ["sleep", 50],

            ["tt", 502, 420], // 普攻*3
            ["sleep", 50],
            ["tt", 502, 420],
            ["sleep", 50],
            ["tt", 502, 420],
            ["sleep", 50],

            ["tt", 561, 288], // 大招*3
            ["sleep", 50],
            ["tt", 561, 288],
            ["sleep", 50],
            ["tt", 561, 288],
            ["sleep", 50],

            ["hold", 445, 424, 300], // 长按技能
            ["sleep", 50],

            ["hold", 502, 420, 300], // 长按普攻
            ["sleep", 50],

            ["tt", 558, 354], // 切人
            ["sleep", 100],
        ],
    };

    return { ...defaultConfig, ...userConfig };
};
