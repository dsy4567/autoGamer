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
        userDataDir,
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
    const globalConfig = getGlobalConfig();
    const scriptConfig = loadScriptConfig(ctx);

    enableHotReload();

    /** @type {Record<"top", ["tt", number, number]>} */
    const tapBackBtn = {
        top: ["tt", 633, 26],
    };

    /** 检查是否已启动 */
    async function checkEnterMainFailed() {
        const onFail = scriptConfig.onEnterMainFail;
        let failed = false;
        await action("检查是否已启动", [
            tapBackBtn.top,
            ["sleep", 1000],
            tapBackBtn.top,
            ["sleep", 1000],

            // 打开小地图
            ["tt", 55, 67],
            ["sleep", 3000],

            [
                "cs",
                "小地图界面.png",
                {
                    threshold: 0.98,
                    clip: { x: 0, y: 0, width: 36, height: 48 },
                    recheckInterval: 3000,
                    recheckCount: 3,
                    inverse: true,
                },
                [["fn", () => (failed = true)]],
            ],

            tapBackBtn.top,
            ["sleep", 1000],
            tapBackBtn.top,
            ["sleep", 1000],
        ]);
        if (failed) {
            try {
                (typeof onFail === "function" ? onFail : () => {})();
            } catch (e) {
                log("ERROR: onFail 失败:", e);
            }

            log("ERROR: 游戏似乎未进入主界面，正在退出");
        }
        return failed;
    }
    /** 领取简单奖励 */
    async function receiveSimpleRewards() {
        log("-----领取简单奖励-----");
        await action("进入每日实训", [
            ["tt", 495, 20],
            ["sleep", 2000],
        ]);

        await action("领取登录游戏活跃度", [
            ["tt", 108, 344],
            ["sleep", 500],
        ]);

        await action("进入派遣页面", [
            ["tt", 127, 351],
            ["sleep", 2000],
        ]);

        await action("点击一键领取", [
            ["tt", 508, 378],
            ["sleep", 500],
        ]);

        await action("点击空白处", [
            ["tt", 320, 342],
            ["sleep", 500],
        ]);

        await action("关闭派遣页面", [tapBackBtn.top, ["sleep", 3000]]);

        await action("领取派遣活跃度", [
            ["tt", 110, 353],
            ["sleep", 1000],
        ]);

        await action("活跃度兑换奖励", [
            ["tt", 196, 155],
            ["sleep", 1000],
            ["tt", 196, 155],
            ["sleep", 500],
            ["fn", globalConfig.checkpoint],
        ]);

        await action("关闭每日实训页面", [tapBackBtn.top, ["sleep", 3000]]);
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
                        ["sleep", 1500],
                        ["tt", 358, 293], // 提前解锁提示

                        ["sleep", 1000],

                        ["tt", 534, 257], // 遗器本，正常情况二者仅有一个点不中
                        ["sleep", 1500],
                        ["tt", 358, 293], // 提前解锁提示

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
                    ["sleep", 500],
                ]);

                await action("点击挑战按钮", [
                    ["tt", 498, 436],
                    ["sleep", 3000],
                ]);

                await action("选择1号队伍", [
                    ["drag", 196, 31, 492, 31, 200],
                    ["sleep", 500],
                    ["drag", 196, 31, 492, 31, 200],
                    ["sleep", 1000],
                    ["tt", 198, 29],
                    ["sleep", 500],
                ]);

                await action("开始挑战", [
                    ["tt", 524, 435],
                    // ["sleep", scriptConfig.dungeonFightTime * 1000],
                    ["sleep", 15000],

                    // 跳过教程
                    ["tt", 8, 468],
                    ["sleep", 3000],
                    ["tt", 8, 468],
                    ["sleep", 3000],
                    ["tt", 8, 468],
                    ["sleep", 3000],
                    ["tt", 8, 468],
                    ["sleep", 3000],
                ]);

                try {
                    await action("waitSceneChange", [], {
                        threshold: 0.98,
                        inverse: true,
                        timeout:
                            scriptConfig.dungeonFightTimeout ?? 25 * 60 * 1000,
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

            action("检查点", [["fn", globalConfig.checkpoint]], {
                screenshot: false,
            });

            await action("退出关卡", [
                ["tt", 215, 435],
                ["sleep", 10000],
            ]);

            await action("关闭副本页", [
                ["tt", 8, 468],
                ["sleep", 3000],
                ["tt", 8, 468],
                ["sleep", 3000],
                ["tt", 8, 468],
                ["sleep", 3000],
                tapBackBtn.top,
                ["sleep", 5000],
            ]);

            if (index === 0) {
                await action("重新进入每日实训", [
                    ["tt", 495, 20],
                    ["sleep", 5000],
                ]);
                await action("领取战斗活跃度", [
                    ["tt", 110, 353],
                    ["sleep", 500],
                    ["tt", 110, 353],
                    ["sleep", 500],
                ]);

                await action("活跃度兑换奖励", [
                    ["tt", 377, 154],
                    ["sleep", 500],
                    ["tt", 377, 154],
                    ["sleep", 500],
                    ["fn", globalConfig.checkpoint],
                ]);

                await action("关闭每日实训", [tapBackBtn.top, ["sleep", 3000]]);
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
            ["sleep", 500],
        ]);

        await action("点击奖励标签页", [
            ["tt", 33, 70],
            ["sleep", 3000],
        ]);

        await action("点击全部领取", [
            ["tt", 433, 396],
            ["sleep", 500],
            ["tt", 433, 396],
            ["sleep", 500],
            ["fn", globalConfig.checkpoint],
        ]);

        await action("关闭纪行页面", [tapBackBtn.top, ["sleep", 3000]]);
    }

    /** 进入主界面 */
    async function enterMain() {
        await action("同意用户协议/点击开始游戏", [
            [
                "fn",
                async () => {
                    await sleep(15000);
                    await tt(432, 290);
                },
            ],
        ]);

        await action("初始等待", [
            ["sleep", scriptConfig.startupDelays.initialWait],
        ]);

        // NOTE: 已废弃点击同意用户协议

        try {
            await action(
                "waitSceneChange",
                [
                    ["tt", 432, 290],
                    ["sleep", 4500],
                ],
                {
                    threshold: 0.9,
                    timeout: 10 * 60 * 1000,
                    interval: 3000,
                },
            );
            // await action("检测到场景变化后点击开始游戏", [
            //     ["sleep", 3000],
            //     ["tt", 432, 290],
            //     ["sleep", 3000],
            // ]);
        } catch (e) {
            log("ERROR: 等待场景变化超时", e);
            await action("等待场景变化超时后人工干预", [
                ["mi", "请手动点击开始游戏后，按快捷键取消干预", 60000],
            ]);
        }

        await action("等待读条", [
            ["sleep", scriptConfig.startupDelays.afterStartGame],
        ]);
    }

    /** 主函数 */
    async function main() {
        await enterMain();
        if (await checkEnterMainFailed()) return;
        await receiveSimpleRewards();
        await dungeonFight();
        await getJiXingReward();
    }

    await runGame(ctx, "崩坏：星穹铁道", scriptConfig, main, code =>
        eval(code),
    );
};
