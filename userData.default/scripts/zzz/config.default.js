// @ts-check
// ⚠️ 此文件在执行 init 或首次自动初始化时会被强制覆盖，请勿直接修改。
// 如需自定义配置，请编辑 scriptData/zzz/config.js（由 loadUserConfig 自动创建）。
const path = require("path");

/**
 * @param {{ loadUserConfig: typeof import("../../../loadUserConfig.js"), dataDir: string, scriptId: string }} ctx
 */
module.exports = function (ctx) {
    const { loadUserConfig, dataDir, scriptId } = ctx;
    const userConfig = loadUserConfig(
        path.join(dataDir, "scriptData", scriptId, "config.js"),
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
     *   isReturn: boolean,
     *   selectPromoterActions: [string, number, number][],
     *   customCardGroupSpacingOffset: [number, number],
     *   customCardGroupSpacing: number,
     *   manualInterventionDelay: number,
     *   dungeonFightTimeout: number,
     *   customTemplateIndex: number,
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
        /** 任务超时时间（毫秒），默认 30 分钟 */
        taskTimeoutMs: 30 * 60 * 1000,
        /** 启动阶段延时配置（毫秒） */
        startupDelays: {
            /** 等待页面 初始加载 */
            initialWait: 40 * 1000,
            /** 同意用户协议后等待 */
            // afterAgreement: 90 * 1000,
            /** 点击开始游戏后等待读条 */
            afterStartGame: 30 * 1000,
        },
        /** （弃用，回归前3天建议自己玩）玩家是否处于回归状态 */
        isReturn: true,
        /** 录像店-邦布-选择宣传员，要选择的宣传员坐标，默认第一个即邦布 */
        selectPromoterActions: [["tt", 205, 175]],
        /** customCardGroupSpacing 偏移量，单位像素 */
        customCardGroupSpacingOffset: [85, 330],
        /** 自定义卡组选项的间隔，单位像素 */
        customCardGroupSpacing: 115,
        /** 进入副本前预留人工干预时间（毫秒） */
        manualInterventionDelay: 0 * 1000,
        /** 副本预计战斗时长（毫秒） */
        dungeonFightTimeout: 10 * 60 * 1000,
        /** 材料本-自定义模板序号，范围 [0, 4] */
        customTemplateIndex: 0,
        /** 刷本次数，默认 3 次 */
        dungeonRunCount: 3,
        /** 自定义副本打怪操作，推荐操作总时长接近小于 10000 毫秒 */
        // WARN: 别用下面没列出的坐标，像素值也不要碰，别问为什么
        customFightActions: [
            ["tt", 445, 424], // 技能*3
            ["sleep", 50],
            ["tt", 445, 424],
            ["sleep", 50],
            ["tt", 445, 424],
            ["sleep", 50],

            ["tt", 502, 392], // 普攻*3
            ["sleep", 50],
            ["tt", 502, 392],
            ["sleep", 50],
            ["tt", 502, 392],
            ["sleep", 50],

            ["tt", 561, 288], // 大招*3
            ["sleep", 50],
            ["tt", 561, 288],
            ["sleep", 50],
            ["tt", 561, 288],
            ["sleep", 50],

            ["hold", 445, 424, 300], // 长按技能
            ["sleep", 50],

            ["hold", 502, 392, 300], // 长按普攻
            ["sleep", 50],

            ["tt", 558, 354], // 切人
            ["sleep", 100],
        ],
    };

    return { ...defaultConfig, ...userConfig };
};
