// ⚠️ 此文件在执行 init 或首次自动初始化时可能会被强制覆盖，请勿直接修改。
// 如需自定义脚本逻辑，请将整个 scripts/zzz/ 目录复制为新的 id（如 scripts/myZzz/），在新目录修改并用新 id 运行：node index.js myZzz

/**
 * @fileoverview 脚本 绝区零
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: MIT
 */

// @ts-check
"use strict";

/// <reference path="../../autoGamer.d.ts" />

const loadScriptConfig = require("./config.default.js");
const { runGame, eMain } = require("../../share/gameRunner.js");

/** @type {Record<"top" | "middleTop", ["tt", number, number]>} */
const tapBackBtn = {
    top: ["tt", 46, 30],
    middleTop: ["tt", 28, 76],
};

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
    } = createUtils(ctx, code => eval(code));
    const config = getGlobalConfig();
    const scriptConfig = loadScriptConfig(ctx);

    /** 传送到六分街-咖啡店 */
    async function goSixthStreet() {
        await action("点击首页快捷导航", [
            ["tt", 539, 118],
            ["sleep", 3000],
            // 如果点到了小地图，再点一次右上角快捷导航
            tapBackBtn.middleTop,
            ["sleep", 3000],
        ]);

        await action("选择六分街", [
            ["tt", 101, 154],
            ["sleep", 1000],
        ]);

        await action("选择咖啡店", [
            ["drag", 181, 380, 589, 380, 1146],
            ["sleep", 1000],
            ["tt", 193, 380],
            ["sleep", 1000],
        ]);

        await action("确认传送到咖啡店", [
            ["tt", 392, 289],
            ["sleep", 20000],
        ]);

        // 未知是否勾选了 直接打开功能页面（每日首次），为了避免引发非预期行为，关闭咖啡店页面
        await action("关闭咖啡店页面", [tapBackBtn.middleTop, ["sleep", 5000]]);
        // 等待用户干预
        if (scriptConfig.coffeeShopInterventionDelay > 0) {
            await action("咖啡店人工干预等待", [
                [
                    "mi",
                    "请及时完成人工干预（例如完成信赖任务），随后靠近咖啡店并结束干预",
                    scriptConfig.coffeeShopInterventionDelay,
                ],
                ["fn", config.checkpoint],
            ]);
        }
    }

    /** 前往咖啡店 */
    async function goCoffeeShop() {
        // await action("打开手册", [
        //     ["tt", 484, 30],
        //     ["sleep", 3000],
        // ]);

        // await action("点击前往，品尝咖啡", [
        //     ["tt", 319, 356],
        //     ["sleep", 10 * 1000],
        // ]);

        await action("进入咖啡店", [
            ["tt", 497, 387],
            ["sleep", 5000],
        ]);

        await action("选择咖啡", [
            ["tt", 45 + scriptConfig.coffeeIndex * 85, 340],
            ["sleep", 3000],
        ]);

        await action("点击点单按钮", [
            ["tt", 580, 381],
            ["sleep", 5 * 1000],
            ["tt", 544, 80],
            ["sleep", 3000],
            ["fn", config.checkpoint],
        ]);

        // TODO: 体力达到上限后无法摄取咖啡，在readme提醒 允许自定义咖啡

        await action("点击确认和返回", [
            ["tt", 323, 318],
            ["sleep", 3000],
            tapBackBtn.middleTop,
            ["sleep", 3000],
        ]);

        // 等待用户干预
        if (scriptConfig.coffeeShopInterventionDelay > 0) {
            await action("咖啡店人工干预等待", [
                [
                    "mi",
                    "请及时完成人工干预（例如完成信赖任务），随后在咖啡店附近结束干预",
                    scriptConfig.coffeeShopInterventionDelay,
                ],
                ["fn", config.checkpoint],
            ]);
        }
    }

    /** 前往报刊亭 */
    async function goMagazineShop() {
        await action("打开手册", [
            ["tt", 484, 30],
            ["sleep", 3000],
        ]);

        await action("点击前往，去报刊亭", [
            ["tt", 319, 356],
            ["sleep", 10 * 1000],
        ]);

        await action("靠近狗狗，进入报刊亭", [
            ["drag", 142, 365, 141, 319],
            ["sleep", 3000],
            ["tt", 497, 387],
            ["sleep", 5000],
        ]);

        await action("叫醒狗狗", [
            ["tt", 333, 470],
            ["sleep", 3000],
            ["tt", 461, 307],
            ["sleep", 5000],
        ]);

        await action("点击刮刮卡", [
            ["tt", 47, 362],
            ["sleep", 1000],
        ]);

        await action("刮卡", [
            ["drag", 246, 236, 377, 236, 200],
            ["sleep", 500],
            ["drag", 251, 254, 384, 252, 200],
            ["sleep", 500],
            ["drag", 250, 271, 380, 270, 200],
            ["sleep", 3000],
        ]);

        await action("点击确认", [
            ["tt", 323, 318],
            ["sleep", 1000],
            ["fn", config.checkpoint],
        ]);

        await action("关闭刮刮卡、报刊亭页面", [
            ["tt", 43, 81],
            ["sleep", 1000],
            ["tt", 43, 81],
            ["sleep", 5000],
        ]);

        // 等待用户干预
        if (scriptConfig.magazineShopInterventionDelay > 0) {
            await action("报刊亭人工干预等待", [
                [
                    "mi",
                    "请及时完成人工干预（例如完成信赖任务），随后在报刊亭附近结束干预",
                    scriptConfig.magazineShopInterventionDelay,
                ],
                ["fn", config.checkpoint],
            ]);
        }
    }

    /** 前往录像店 */
    async function goVideoShop() {
        await action("打开手册", [
            ["tt", 484, 30],
            ["sleep", 3000],
        ]);

        await action("点击前往，去录像店", [
            ["tt", 319, 356],
            ["sleep", 20 * 1000],
        ]);

        await action("靠近邦布", [
            ["drag", 138, 374, 198, 330],
            ["sleep", 1000],
        ]);

        await action("与邦布交互", [
            ["tt", 505, 397],
            ["sleep", 5000],
        ]);

        await action("关闭昨日账本", [
            ["tt", 308, 412],
            ["sleep", 1000],
        ]);

        await action("进入选择宣传员页面", [
            ["tt", 280, 320],
            ["sleep", 1000],
        ]);

        // 使用默认宣传员
        // TODO: 这写的不好，不知道为什么报错
        // @ts-ignore
        await action("选择宣传员", [
            ...(scriptConfig.selectPromoterActions?.[0]
                ? scriptConfig.selectPromoterActions
                : [["tt", 205, 175]]),
            ["sleep", 3000],
        ]);

        await action("点击确定", [
            ["tt", 548, 401],
            ["sleep", 1000],
        ]);

        await action("进入选择录像带页面", [
            ["tt", 381, 316],
            ["sleep", 1000],
        ]);

        await action("点击推荐上架", [
            ["tt", 423, 400],
            ["sleep", 1000],
        ]);

        await action("点击开始营业", [
            ["tt", 549, 390],
            ["sleep", 1000],
        ]);

        await action("点击确定", [
            ["tt", 379, 279],
            ["sleep", 1000],
            // 开业大吉
            ["fn", config.checkpoint],
            ["tt", 318, 276],
            ["sleep", 3000],
        ]);
    }

    /** 领取纪行奖励 */
    async function getJiXingReward() {
        await action("进入纪行界面", [
            ["tt", 517, 30],
            ["sleep", 3000],
        ]);

        await action("点击成长任务", [
            ["tt", 463, 80],
            ["sleep", 1000],
        ]);

        await action("点击全部领取", [
            ["tt", 556, 397],
            ["sleep", 1000],
        ]);

        await action("点击等级回馈", [
            ["tt", 369, 81],
            ["sleep", 1000],
        ]);

        await action("点击全部领取", [
            ["tt", 400, 395],
            ["sleep", 1000],
            ["tt", 400, 395],
            ["sleep", 1000],
            ["fn", config.checkpoint],
        ]);

        await action("关闭纪行奖励页面", [
            ["tt", 38, 84],
            ["sleep", 5000],
        ]);
    }

    /** 领取手册奖励 */
    async function getManualReward() {
        await action("打开手册", [
            ["tt", 484, 30],
            ["sleep", 3000],
        ]);

        await action("领取全部奖励", [
            ["tt", 237, 154],
            ["sleep", 1000],
        ]);

        await action("点击确认", [
            ["tt", 327, 322],
            ["sleep", 1000],
            ["fn", config.checkpoint],
        ]);

        await action("关闭手册", [
            ["tt", 599, 148],
            ["sleep", 3000],
        ]);
    }

    /** 前往HIA俱乐部 */
    async function goHIA() {
        await action("点击首页快捷导航", [
            ["tt", 539, 118],
            ["sleep", 3000],
            // 如果点到了小地图，再点一次右上角快捷导航
            ["tt", 484, 77],
            ["sleep", 3000],
        ]);

        await action("选择HIA俱乐部", [
            ["tt", 106, 227],
            ["sleep", 1000],
            ["tt", 252, 378],
            ["sleep", 1000],
        ]);

        await action("确认传送到HIA俱乐部", [
            ["tt", 392, 289],
            ["sleep", 20000],
        ]);

        await action("靠近柏莎-材料本", [
            ["drag", 138, 365, 139, 309, 591],
            ["sleep", 3000],
        ]);
    }

    /** 刷本 */
    async function dungeonFight(needGoHIA = true) {
        if (!scriptConfig.customFightActions?.[0])
            return log("WARN: 自定义战斗操作为空，无法刷本");
        if (needGoHIA) await goHIA();

        await action("等待人工干预", [
            [
                "mi",
                `请及时完成人工干预（例如 补充足够体力，预计战斗次数${scriptConfig.dungeonRunCount}），随后回到主界面，靠近柏莎 NPC并结束干预`,
                scriptConfig.manualInterventionDelay,
            ],
        ]);

        await action("与柏莎-材料本交互", [
            ["tt", 500, 391],
            ["sleep", 3000],
            ["tt", 476, 306],
            ["sleep", 3000],
        ]);

        await action("选择自定义模板", [
            ["tt", 471, 242],
            ["sleep", 3000],
        ]);

        await action("选择模板内卡组", [
            [
                "tt",
                scriptConfig.customCardGroupSpacingOffset[0] +
                    scriptConfig.customCardGroupSpacing *
                        scriptConfig.customTemplateIndex,
                scriptConfig.customCardGroupSpacingOffset[1],
            ],
            ["sleep", 1000],
        ]);

        for (let i = 0; i < scriptConfig.dungeonRunCount; i++) {
            log(`----------第${i + 1}次战斗----------`);

            await action("开始战斗", [
                ["tt", 556, 398],
                ["sleep", 5000],
                ["tt", 556, 398],
            ]);

            // 等待副本加载完成
            try {
                await action("waitSceneChange", [], {
                    threshold: 0.98,
                    interval: 3000,
                    timeout: 60000,
                });
            } catch (e) {
                log("ERROR: 等待副本加载完成失败", e);
                await action("等待副本加载完成-兜底", [["sleep", 20000]]);
            }

            let fightFinished = false;

            // 并行执行：waitSceneChange 检测结算画面 + 循环执行战斗操作
            await Promise.all([
                (async () => {
                    try {
                        await action("waitSceneChange", [], {
                            threshold: 0.99,
                            interval: 5000,
                            timeout: scriptConfig.dungeonFightTimeout,
                            inverse: true,
                            recheckCount: 3,
                        });
                    } catch (e) {
                        log("WARNING: 检测结算画面超时，兜底等待");
                        await action("战斗兜底等待", [
                            ["sleep", scriptConfig.dungeonFightTimeout],
                        ]);
                    } finally {
                        fightFinished = true;
                    }
                })(),
                (async () => {
                    while (!fightFinished) {
                        await action(
                            "执行战斗操作",
                            scriptConfig.customFightActions,
                            {
                                screenshot: false,
                            },
                        );
                    }
                })(),
            ]);

            // 来不及检测，会点到开始战斗
            await action("点击完成/开始战斗", [
                ["tt", 556, 398],
                ["sleep", 20000],
                ["fn", config.checkpoint],
            ]);
        }

        await action("离开副本", [
            tapBackBtn.middleTop,
            ["sleep", 1000],
            tapBackBtn.middleTop,
            ["sleep", 1000],
            tapBackBtn.middleTop,
            ["sleep", 5000],
            ["fn", config.checkpoint],
        ]);
    }

    /** 首次进入主界面后操作 */
    async function firstEnterMainGame() {
        await action("疯狂关闭弹窗", [
            // 左上角关闭按钮/误触菜单
            tapBackBtn.top,
            ["sleep", 3000],
            tapBackBtn.top,
            ["sleep", 3000],

            // 底部空白处
            ["tt", 303, 472],
            ["sleep", 1000],
            ["tt", 303, 472],
            ["sleep", 1000],

            // 左上角靠下关闭按钮
            tapBackBtn.middleTop,
            ["sleep", 5000],
            tapBackBtn.middleTop,
            ["sleep", 5000],
        ]);
        await action("关闭弹窗后等待", [["sleep", 10000]]);

        await goSixthStreet();
        await goCoffeeShop();
        await goMagazineShop();
        await goVideoShop();
        await getManualReward();
        await dungeonFight();
        await getJiXingReward();
    }

    async function main() {
        await action("初始等待", [
            ["sleep", scriptConfig.startupDelays.initialWait],
        ]);

        // NOTE: 已废弃点击同意用户协议
        // await action("同意用户协议/点击开始游戏", [
        //     ["tt", 384, 317],
        //     ["sleep", scriptConfig.startupDelays.afterAgreement],
        // ]);

        try {
            await action("waitSceneChange", [["tt", 384, 317]], {
                threshold: 0.97,
                interval: 3000,
            });
            await action("检测到场景变化后点击开始游戏", [
                ["sleep", 3000],
                ["tt", 384, 317],
                ["sleep", 3000],
            ]);
        } catch (e) {
            log("ERROR: 等待场景变化超时", e);
            await action("等待场景变化超时后兜底等待", [["sleep", 90000]]);
        }

        await action("兜底点击开始游戏，等待读条", [
            ["tt", 384, 317],
            ["sleep", scriptConfig.startupDelays.afterStartGame],
        ]);

        // if (!scriptConfig.isReturn) {
        //     await firstReturnGame();
        // }
        await firstEnterMainGame();
    }

    await runGame(ctx, "绝区零", scriptConfig, main, code => eval(code));
};
