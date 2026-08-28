// ⚠️ 此文件在执行 init 或首次自动初始化时可能会被强制覆盖，请勿直接修改。
// 如需自定义脚本逻辑，请将整个 scripts/zzz/ 目录复制为新的 id（如 scripts/myZzz/），在新目录修改并用新 id 运行：node index.js myZzz

/**
 * @fileoverview 脚本 绝区零
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
    } = createUtils(ctx, code => eval(code));
    const config = getGlobalConfig();
    const scriptConfig = loadScriptConfig(ctx);

    enableHotReload();

    /** 版本末期无纪行按钮时，打开手册按钮X轴偏移量 */
    let manualBtnXOffset = 0;
    /** @type {number|null} 版本末期无纪行按钮时，打开纪行按钮Y轴偏移量，null表示不打开 */
    let jiXingBtnXOffset = 0;

    /** @type {Record<"top" | "middleTop", [number, number]>} */
    const backBtnPos = {
        top: [46, 28],
        middleTop: [28, 76],
    };
    /** @type {Record<"top" | "middleTop", (onMatch: AutoGamer.OperationArray, onError: AutoGamer.OperationArray, inverse?: boolean) => ["cs", string, AutoGamer.CompareScreenshotOptions?, AutoGamer.OperationArray?, AutoGamer.OperationArray?]>} */
    const matchBackBtn = {
        top: (onMatch, onError, inverse = false) => [
            "cs",
            "backBtn.png",
            {
                clip: { x: 40, y: 10, width: 20, height: 20 },
                threshold: 0.99,
                inverse,
            },
            onMatch,
            onError,
        ],
        middleTop: (onMatch, onError, inverse = false) => [
            "cs",
            "backBtn.png",
            {
                clip: { x: 40, y: 70, width: 20, height: 20 },
                threshold: 0.99,
                inverse,
            },
            onMatch,
            onError,
        ],
    };
    /** @type {Record<"top" | "middleTop", ["cs", string, AutoGamer.CompareScreenshotOptions?, AutoGamer.OperationArray?, AutoGamer.OperationArray?]>} */
    const tapBackBtn = {
        top: matchBackBtn.top(
            [["tt", ...backBtnPos.top]],
            [
                [
                    "fn",
                    () => {
                        log("WARNING: 检查返回按钮（top）是否可用失败");
                    },
                ],
                ["tt", ...backBtnPos.top],
            ],
        ),
        middleTop: matchBackBtn.middleTop(
            [["tt", ...backBtnPos.middleTop]],
            [
                [
                    "fn",
                    () => {
                        log("WARNING: 检查返回按钮（middleTop）是否可用失败");
                    },
                ],
                ["tt", ...backBtnPos.middleTop],
            ],
        ),
    };

    /** 取消追踪任务 */
    async function cancelTrackingTask() {
        await action("打开任务列表", [
            ["tt", 562, 359],
            ["sleep", 3000],
        ]);

        await action("停止追踪", [
            [
                "cs",
                "停止追踪.png",
                {
                    clip: { x: 81, y: 347, width: 114, height: 39 },
                    threshold: 0.99,
                },
                [["tt", 98, 364]],
            ],
        ]);

        await action("关闭任务列表", [
            ["sleep", 1000],
            tapBackBtn.middleTop,
            ["sleep", 3000],
            tapBackBtn.middleTop,
            ["sleep", 3000],
        ]);
    }

    /** 调整时间至凌晨 */
    async function adjustTimeToNight() {
        await action("调整时间至凌晨-前置检查及最终切换", [
            ["tt", 140, 26],
            ["sleep", 3000],
            ["tt", 312, 103],
            ["sleep", 1000],
            [
                "cs",
                "调整时间是否可用.png",
                {
                    clip: {
                        x: 50,
                        y: 90,
                        width: 550,
                        height: 80,
                    },
                    threshold: 0.99,
                },
                [
                    ["tt", 514, 324],
                    ["sleep", 500],
                    ["tt", 317, 366],
                    ["sleep", 8000],
                ],
            ],
            tapBackBtn.middleTop,
            ["sleep", 3000],
        ]);
    }

    /** 妮可 信赖任务（六分街报刊亭） */
    async function onMeetNicoleAtMagazineShop() {
        // @ts-ignore
        await action("信赖任务（六分街报刊亭）", [
            ["tt", 490, 413],
            ["sleep", 3000],
            ["tt", 490, 413],
            ["sleep", 3000],
            // 第一个对话选项
            ["tt", 454, 272],
            ["sleep", 3000],

            // 重复8次
            ...Array.from({ length: 8 }, () => [
                ["tt", 292, 388],
                ["sleep", 3000],
            ]).flat(),
        ]);
        await action("兜底返回", [
            tapBackBtn.middleTop,
            ["sleep", 3000],
            tapBackBtn.middleTop,
            ["sleep", 3000],
        ]);
    }

    /** 打开手册 */
    async function openManual() {
        if (manualBtnXOffset) {
            // 特殊处理周年庆/版本末期
            // 原理：手册页不适用 tapBackBtn.middleTop

            // 周年庆期间按钮顺序参考:
            // |好友            |活动            |手册            |纪行            |抽卡            |周年庆
            // |-              |-              |-              |任何版本末期无     |-              |周年庆版本末期仍有
            // 注：周年庆按钮仅在周年庆整个版本期间出现

            let manualOpened = true;
            const matchBackBtnMiddleTop = matchBackBtn.middleTop(
                [
                    ["tt", ...backBtnPos.middleTop],
                    [
                        "fn",
                        () => {
                            manualOpened = false;
                        },
                    ],
                ],
                [
                    ["tt", ...backBtnPos.middleTop],
                    [
                        "fn",
                        () =>
                            log(
                                "WARNING: 检查返回按钮（middleTop）是否可用失败",
                            ),
                    ],
                ],
            );

            await action("打开手册", [
                ["tt", 484 - manualBtnXOffset, 30], // 倒四按钮，(周年庆+平时)为手册，(非周年庆+版本末期)为好友，(非周年庆+平时)||(周年庆+版本末期)为活动
                ["sleep", 3000],
                matchBackBtnMiddleTop,
                ["sleep", 1500],
            ]);
            jiXingBtnXOffset = -30; // 周年庆+平时倒三，平时倒二

            if (!manualOpened) {
                manualOpened = true;
                await action("打开手册-2", [
                    ["tt", 484, 30], // 倒三按钮，(周年庆+版本末期)||(非周年庆+平时)为手册，(非周年庆+版本末期)为活动；大概率点不到的有：(周年庆+平时)为纪行
                    ["sleep", 3000],
                    matchBackBtnMiddleTop,
                    ["sleep", 1500],
                ]);
                jiXingBtnXOffset = 0; // 非周年庆+平时
            }

            if (!manualOpened) {
                manualOpened = true;
                await action("打开手册-3", [
                    ["tt", 484 + manualBtnXOffset, 30], // 倒二按钮，(非周年庆+版本末期)为手册；大概率点不到的有：(周年庆+平时)||(周年庆+版本末期)为抽卡，(非周年庆+平时)为纪行
                    ["sleep", 2000],
                    matchBackBtnMiddleTop,
                    ["sleep", 1500],
                ]);
                jiXingBtnXOffset = null; // 非周年庆+版本末期
            }
        } else {
            await action("打开手册", [
                ["tt", 484, 30], // 倒三按钮
                ["sleep", 3000],
            ]);
        }
    }

    /** 传送到六分街-改装店-咖啡店 */
    async function goSixthStreet() {
        await action("点击首页快捷导航", [
            ["tt", 539, 118],
            ["sleep", 3000],
            // 如果点到了小地图，再点一次右上角快捷导航
            ["tt", 484, 77],
            ["sleep", 3000],
            // 关闭潜在的新地图弹窗
            ["tt", 484, 77],
            ["sleep", 3000],
        ]);

        // 这次传送是为了重置角色朝向
        await action("选择六分街", [
            ["tt", 101, 154],
            ["sleep", 500],
        ]);

        await action("选择改装店", [
            ["drag", 181, 380, 589, 380, 200],
            ["sleep", 500],
            ["tt", 442, 380],
            ["sleep", 500],
        ]);

        await action("确认传送到改装店", [
            ["tt", 392, 289],
            ["sleep", 17000],
        ]);

        // 未知是否勾选了 直接打开功能页面（每日首次），为了避免引发非预期行为，关闭改装店页面
        await action("关闭改装店页面", [tapBackBtn.middleTop, ["sleep", 3000]]);

        await action("点击首页快捷导航", [
            ["tt", 539, 118],
            ["sleep", 3000],
            // 如果点到了小地图，再点一次右上角快捷导航
            ["tt", 484, 77],
            ["sleep", 3000],
        ]);

        await action("选择六分街", [
            ["tt", 101, 154],
            ["sleep", 500],
        ]);

        await action("选择咖啡店", [
            ["drag", 181, 380, 589, 380, 200],
            ["sleep", 500],
            ["tt", 193, 380],
            ["sleep", 500],
        ]);

        await action("确认传送到咖啡店", [
            ["tt", 392, 289],
            ["sleep", 7 * 1000],
        ]);

        // 未知是否勾选了 直接打开功能页面（每日首次），为了避免引发非预期行为，关闭咖啡店页面
        await action("关闭咖啡店页面", [tapBackBtn.middleTop, ["sleep", 3000]]);

        // 等待用户干预
        // if (scriptConfig.coffeeShopInterventionDelay > 0) {
        //     await action("咖啡店人工干预等待", [
        //         [
        //             "mi",
        //             "请及时完成人工干预（例如完成信赖任务），随后靠近咖啡店并结束干预",
        //             scriptConfig.coffeeShopInterventionDelay,
        //         ],
        //         ["fn", config.checkpoint],
        //     ]);
        // }
    }

    /** 前往咖啡店 */
    async function goCoffeeShop() {
        await action("进入咖啡店", [
            ["tt", 497, 387],
            ["sleep", 5000],
        ]);

        await action("选择咖啡", [
            ["tt", 45 + scriptConfig.coffeeIndex * 85, 340],
            ["sleep", 500],
        ]);

        await action("点击点单按钮", [
            ["tt", 580, 381],
            ["sleep", 5 * 1000],
            // 跳过
            ["tt", 538, 105],
            ["sleep", 3000],
            ["fn", config.checkpoint],
        ]);

        // TODO: 体力达到上限后无法摄取咖啡，在readme提醒

        await action("点击确认和返回", [
            ["tt", 323, 318],
            ["sleep", 1000],
            // 特效咖啡
            ["tt", 384, 291],
            ["sleep", 1000],
            tapBackBtn.middleTop,
            ["sleep", 3000],
        ]);

        // 等待用户干预
        // if (scriptConfig.coffeeShopInterventionDelay > 0) {
        //     await action("咖啡店人工干预等待", [
        //         [
        //             "mi",
        //             "请及时完成人工干预（例如完成信赖任务），随后在咖啡店附近结束干预",
        //             scriptConfig.coffeeShopInterventionDelay,
        //         ],
        //         ["fn", config.checkpoint],
        //     ]);
        // }
    }

    /** 前往六分街报刊亭 */
    async function goMagazineShop() {
        await openManual();

        await action("点击前往，去报刊亭", [
            ["tt", 319, 356],
            ["sleep", 7 * 1000],
        ]);

        // 未知是否勾选了 直接打开功能页面（每日首次），为了避免引发非预期行为，关闭报刊亭页面
        await action("关闭报刊亭页面", [tapBackBtn.middleTop, ["sleep", 3000]]);

        await action("靠近狗狗，进入报刊亭", [
            ["hold", 156, 336, 452],
            ["sleep", 3000],
            ["tt", 497, 387],
            ["sleep", 5000],
        ]);

        await action("叫醒狗狗", [
            ["tt", 333, 470],
            ["sleep", 3000],
            ["tt", 461, 307],
            ["sleep", 3000],
            ["tt", 461, 307],
            ["sleep", 3000],
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
            ["sleep", 500],
            ["fn", config.checkpoint],
        ]);

        await action("关闭刮刮卡、报刊亭页面", [
            ["tt", 43, 81],
            ["sleep", 500],
            ["tt", 43, 81],
            ["sleep", 5000],
        ]);

        // if (scriptConfig.magazineShopInterventionDelay > 0)
        //     await onMeetNicoleAtMagazineShop();
    }

    /** 前往录像店 */
    async function goVideoShop() {
        await openManual();

        await action("点击前往，去录像店", [
            ["tt", 319, 356],
            ["sleep", 17 * 1000],
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
            ["sleep", 500],
        ]);

        await action("进入选择宣传员页面", [
            ["tt", 280, 320],
            ["sleep", 500],
        ]);

        // 使用默认宣传员
        // 直接对 ops 做 @type 声明 + 分支赋值，让 TS 借助赋值上下文正确推断元组类型，
        // 否则三元 + 扩展运算符会让元组退化为 (string|number)[][]，无法匹配 Operation[]
        /** @type {AutoGamer.Operation[]} */
        let selectPromoterOps = [];
        if (scriptConfig.selectPromoterActions?.[0]) {
            selectPromoterOps = [
                ...scriptConfig.selectPromoterActions,
                ["sleep", 500],
            ];
        } else {
            selectPromoterOps = [
                ["tt", 205, 175],
                ["sleep", 500],
            ];
        }
        await action("选择宣传员", selectPromoterOps);

        await action("点击确定", [
            ["tt", 548, 401],
            ["sleep", 500],
        ]);

        await action("进入选择录像带页面", [
            ["tt", 381, 316],
            ["sleep", 500],
        ]);

        await action("点击推荐上架", [
            ["tt", 423, 400],
            ["sleep", 500],
        ]);

        await action("点击开始营业", [
            ["tt", 549, 390],
            ["sleep", 500],
        ]);

        await action("点击确定", [
            ["tt", 379, 279],
            ["sleep", 2000],
            // 开业大吉
            ["fn", config.checkpoint],
            ["tt", 318, 276],
            ["sleep", 3000],
        ]);
    }

    /** 领取纪行奖励 */
    async function getJiXingReward() {
        if (jiXingBtnXOffset === null)
            return log("WARN: 纪行按钮未找到/没有要领取的奖励");

        await action("进入纪行界面", [
            ["tt", 517 + jiXingBtnXOffset, 30],
            ["sleep", 3000],
        ]);

        await action("点击成长任务", [
            ["tt", 463, 80],
            ["sleep", 500],
        ]);

        await action("点击全部领取", [
            ["tt", 556, 397],
            ["sleep", 1000],
        ]);

        await action("点击等级回馈", [
            ["tt", 369, 81],
            ["sleep", 500],
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
        await openManual();

        await action("领取全部奖励", [
            ["tt", 237, 154],
            ["sleep", 1000],
        ]);

        await action("点击确认", [
            ["tt", 303, 472],
            ["sleep", 500],
            ["tt", 303, 472],
            ["sleep", 500],
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
        for (let i = 0; i < scriptConfig.dungeonRunCount; i++) {
            log(`----------第${i + 1}次战斗----------`);

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

            // 体力是否不足
            let isTired = false;
            await action("点击下一步", [
                ["tt", 325, 458], // 空白处
                ["sleep", 500],
                ["tt", 325, 458],
                ["sleep", 2000],

                ["tt", 556, 398], // 下一步按钮
                ["sleep", 2000],
                [
                    "cs",
                    "电量补充-取消图标.png",
                    {
                        clip: { x: 204, y: 332, width: 16, height: 16 },
                        threshold: 0.99,
                    },
                    [
                        ["tt", 206, 340], // 关闭体力弹窗
                        ["sleep", 3000],
                        [
                            "fn",
                            () => {
                                isTired = true;
                                log("WARNING: 体力不足，正在离开副本");
                            },
                        ],
                    ],
                ],
            ]);
            if (isTired) break;

            await action("开始战斗", [
                ["sleep", 5000],
                ["tt", 556, 398],
                ["sleep", 1000],
            ]);

            // 等待副本加载完成
            try {
                log("等待副本加载完成");
                await action("waitSceneChange", [], {
                    threshold: 0.98,
                    interval: 3000,
                    timeout: 60000,
                });
            } catch (e) {
                log("ERROR: 等待副本加载完成失败", e);
                await action("等待副本加载完成-兜底", [["sleep", 10000]]);
            }

            // 并行执行：waitSceneChange 检测结算画面 + 循环执行战斗操作
            try {
                await action("sleep", [["sleep", 3000]]);
                log("执行战斗操作");
                await action(
                    "waitSceneChange",
                    scriptConfig.customFightActions,
                    {
                        threshold: 0.99,
                        interval: 5000,
                        timeout: scriptConfig.dungeonFightTimeout,
                        inverse: true,
                        recheckCount: 3,
                    },
                );
            } catch (e) {
                log("WARNING: 检测结算画面超时，兜底等待");
                await action("战斗兜底等待", [
                    ["sleep", scriptConfig.dungeonFightTimeout],
                ]);
            }

            await action("点击完成战斗", [
                ["tt", 325, 458], // 空白处
                ["sleep", 500],
                ["tt", 325, 458],
                ["sleep", 500],

                ["tt", 556, 398],
                ["sleep", 1000],
            ]);
            // 等待大世界加载完成
            try {
                await action("等待大世界加载完成");
                await action("waitSceneChange", [], {
                    threshold: 0.98,
                    interval: 3000,
                    timeout: 60000,
                });
                await action("sleep", [["sleep", 3000]]);
            } catch (e) {
                log("ERROR: 等待大世界加载完成失败", e);
                await action("等待大世界加载完成-兜底", [["sleep", 20000]]);
            }

            await action("关闭弹窗", [
                ["tt", 325, 458], // 空白处
                ["sleep", 500],
                ["tt", 325, 458],
                ["sleep", 500],
            ]);
        }

        await action("离开副本", [
            tapBackBtn.middleTop,
            ["sleep", 1000],
            tapBackBtn.middleTop,
            ["sleep", 1000],
            tapBackBtn.middleTop,
            ["sleep", 1000],
            tapBackBtn.middleTop,
            ["sleep", 1000],
            ["fn", config.checkpoint],
        ]);
    }

    /** 进入主界面 */
    async function enterMain() {
        await action("同意用户协议/点击开始游戏", [
            [
                "fn",
                async () => {
                    await sleep(5000);
                    await tt(384, 317);
                },
            ],
        ]);
        await action("初始等待", [
            ["sleep", scriptConfig.startupDelays.initialWait],
        ]);

        try {
            await action(
                "waitSceneChange",
                [
                    ["tt", 384, 317],
                    ["sleep", 4500],
                ],
                {
                    threshold: 0.97,
                    timeout: 10 * 60 * 1000,
                    interval: 3000,
                },
            );
            await action("检测到场景变化后点击开始游戏", [
                ["sleep", 3000],
                ["tt", 384, 317],
                ["sleep", 3000],
            ]);
        } catch (e) {
            log("ERROR: 等待场景变化超时", e);
            // TODO: 人工干预超时需处理
            await action("等待场景变化超时后人工干预", [
                ["mi", "请手动点击开始游戏后，按快捷键取消干预", 60000],
            ]);
        }

        await action("等待读条", [
            ["sleep", scriptConfig.startupDelays.afterStartGame],
        ]);

        await action("疯狂关闭弹窗", [
            ["tt", 303, 472],
            ["sleep", 2000],
            tapBackBtn.top,
            ["sleep", 1000],
            tapBackBtn.middleTop,
            ["sleep", 1000],

            ["tt", 303, 472],
            ["sleep", 2000],
            tapBackBtn.top,
            ["sleep", 1000],
            tapBackBtn.middleTop,
            ["sleep", 1000],
        ]);

        await action("关闭弹窗后等待", [["sleep", 3000]]);

        await action("!检查纪行按钮", [
            [
                "cs",
                "纪行按钮.png",
                {
                    clip: { x: 515, y: 20, width: 20, height: 20 },
                    threshold: 0.99,
                    inverse: true,
                },
                [
                    [
                        "fn",
                        async () => {
                            manualBtnXOffset = 30;
                            log(
                                "WARNING: 纪行按钮未找到，可能处于版本末期/周年庆",
                            );
                        },
                    ],
                ],
                [["fn", () => log("WARN: 纪行按钮未找到/没有要领取的奖励")]],
            ],
            ["sleep", 1000],
        ]);
    }

    async function main() {
        await enterMain();
        await cancelTrackingTask();
        await adjustTimeToNight();
        await goSixthStreet();
        await goCoffeeShop();
        await goMagazineShop();
        await goVideoShop();
        await getManualReward();
        await dungeonFight();
        await getJiXingReward();
    }

    await runGame(ctx, "绝区零", scriptConfig, main, code => eval(code));
};
