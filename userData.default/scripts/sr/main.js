// ⚠️ 此文件在执行 init 或首次自动初始化时可能会被强制覆盖，请勿直接修改。
// 如需自定义脚本逻辑，请将整个 scripts/sr/ 目录复制为新的 id（如 scripts/mySr/），在新目录修改并用新 id 运行：node index.js mySr

/**
 * @fileoverview 脚本 崩坏：星穹铁道
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
    } = createUtils(ctx, (/** @type {string} */ code) => eval(code));
    const config = getGlobalConfig();
    const scriptConfig = loadScriptConfig(ctx);

    /** 领取简单奖励 */
    async function receiveSimpleRewards() {
        log("-----领取简单奖励-----");
        await action("进入每日实训", [
            ["tt", 495, 20],
            ["sleep", 3000],
        ]);

        await action("领取登录游戏活跃度", [
            ["tt", 108, 344],
            ["sleep", 1000],
        ]);

        await action("进入派遣页面", [
            ["tt", 127, 351],
            ["sleep", 3000],
        ]);

        await action("点击一键领取", [
            ["tt", 508, 378],
            ["sleep", 1000],
        ]);

        await action("点击空白处", [
            ["tt", 320, 342],
            ["sleep", 1000],
        ]);

        await action("关闭派遣页面", [
            ["tt", 609, 16],
            ["sleep", 3000],
        ]);

        await action("领取派遣活跃度", [
            ["tt", 110, 353],
            ["sleep", 1000],
        ]);

        await action("活跃度兑换奖励", [
            ["tt", 196, 155],
            ["sleep", 1000],
            ["tt", 196, 155],
            ["sleep", 1000],
            ["fn", config.checkpoint],
        ]);

        await action("关闭每日实训页面", [
            ["tt", 612, 27],
            ["sleep", 3000],
        ]);
    }

    /** 刷本 */
    async function dungeonFight(index = 0) {
        for (index = 0; index < scriptConfig.dungeonRunCount; index++) {
            log(`-----刷本${index}-----`);
            await action("进入每日实训", [
                ["tt", 495, 20],
                ["sleep", 3000],
            ]);

            await action("进入生存索引", [
                ["tt", 133, 119],
                ["sleep", 3000],
            ]);

            {
                if (scriptConfig.dungeonType === 4) {
                    await action("进入培养目标首个副本", [
                        ["tt", 533, 220], // 材料本
                        ["tt", 534, 257], // 遗器本，正常情况二者仅有一个点不中
                        ["sleep", 3000],
                    ]);
                } else {
                    await action("进入拟什么金", [
                        ["tt", 121, 261],
                        ["sleep", 3000],
                    ]);
                    switch (scriptConfig.dungeonType) {
                        case 1:
                            await action("进入经验书副本", [
                                ["tt", 539, 193],
                                ["sleep", 3000],
                            ]);
                            break;
                        case 2:
                            await action("进入武器矿副本", [
                                ["tt", 540, 242],
                                ["sleep", 3000],
                            ]);
                            break;
                        case 3:
                            await action("进入钞票副本", [
                                ["tt", 541, 295],
                                ["sleep", 3000],
                            ]);
                            break;
                        default:
                            log("WARNING: 未知副本类型，即将关闭指南页面");
                            await action("关闭指南页面", [
                                ["tt", 612, 28],
                                ["sleep", 3000],
                            ]);
                            return;
                    }
                }

                await action("拉满挑战次数至24次", [
                    ["tt", 563, 398],
                    ["sleep", 200],
                    ["tt", 564, 379],
                    ["sleep", 1000],
                ]);

                await action("点击挑战按钮", [
                    ["tt", 498, 436],
                    ["sleep", 3000],
                ]);

                await action("选择1号队伍", [
                    ["drag", 196, 31, 492, 31, 200],
                    ["sleep", 1000],
                    ["drag", 196, 31, 492, 31, 200],
                    ["sleep", 1000],
                    ["tt", 198, 29],
                    ["sleep", 1000],
                ]);

                await action("开始挑战", [
                    ["tt", 524, 435],
                    // ["sleep", scriptConfig.dungeonFightTime * 1000],
                    ["sleep", 20000],
                ]);

                try {
                    await action("waitSceneChange", [], {
                        threshold: 0.98,
                        inverse: true,
                        timeout:
                            scriptConfig.dungeonFightTimeout ?? 15 * 60 * 1000,
                        interval: 10000,
                        recheckCount: 3,
                    });
                } catch (e) {
                    log("WARNING: 检测结算画面超时，兜底等待", e);
                    await action("战斗兜底等待", [
                        ["sleep", scriptConfig.dungeonFightTimeout],
                    ]);
                }
            }

            action("检查点", [["fn", config.checkpoint]], {
                screenshot: false,
            });

            await action("退出关卡", [
                ["tt", 215, 435],
                ["sleep", 10000],
            ]);

            await action("关闭副本页", [
                ["tt", 610, 29],
                ["sleep", 5000],
            ]);

            if (index === 0) {
                await action("重新进入每日实训", [
                    ["tt", 495, 20],
                    ["sleep", 5000],
                ]);
                await action("领取战斗活跃度", [
                    ["tt", 110, 353],
                    ["sleep", 1000],
                    ["tt", 110, 353],
                    ["sleep", 1000],
                ]);

                await action("活跃度兑换奖励", [
                    ["tt", 377, 154],
                    ["sleep", 1000],
                    ["tt", 377, 154],
                    ["sleep", 1000],
                    ["fn", config.checkpoint],
                ]);

                await action("关闭每日实训", [
                    ["tt", 609, 31],
                    ["sleep", 3000],
                ]);
            }
        }
    }

    /** 领取纪行奖励 */
    async function getJiXingReward() {
        await action("进入纪行页面", [
            ["tt", 431, 15],
            ["sleep", 3000],
        ]);

        await action("点击任务标签页", [
            ["tt", 20, 114],
            ["sleep", 3000],
        ]);

        await action("点击全部领取", [
            ["tt", 526, 400],
            ["sleep", 1000],
        ]);

        await action("点击奖励标签页", [
            ["tt", 33, 70],
            ["sleep", 3000],
        ]);

        await action("点击全部领取", [
            ["tt", 433, 396],
            ["sleep", 1000],
            ["tt", 433, 396],
            ["sleep", 1000],
            ["fn", config.checkpoint],
        ]);

        await action("关闭纪行页面", [
            ["tt", 609, 30],
            ["sleep", 3000],
        ]);
    }

    /** 主函数 */
    async function main() {
        await sleep(scriptConfig.startupDelays.initialWait);

        // NOTE: 已废弃点击同意用户协议
        // await action("同意用户协议/点击开始游戏", [
        //     ["tt", 432, 281],
        //     ["sleep", scriptConfig.startupDelays.afterAgreement],
        // ]);

        try {
            await action("waitSceneChange", [["tt", 432, 281]], {
                threshold: 0.9,
                timeout: 10 * 60 * 1000,
                interval: 10000,
            });
            await action("检测到场景变化后点击开始游戏", [
                ["sleep", 3000],
                ["tt", 432, 281],
                ["sleep", 3000],
            ]);
        } catch (e) {
            log("ERROR: 等待场景变化超时", e);
            await action("等待场景变化超时后兜底等待", [["sleep", 90000]]);
        }

        await action("兜底点击开始游戏，等待读条", [
            ["tt", 432, 281],
            ["sleep", scriptConfig.startupDelays.afterStartGame],
        ]);

        await receiveSimpleRewards();
        await dungeonFight();
        await getJiXingReward();
    }

    await runGame(ctx, "崩坏：星穹铁道", scriptConfig, main, code =>
        eval(code),
    );
};
