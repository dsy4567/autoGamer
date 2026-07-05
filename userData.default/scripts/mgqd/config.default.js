// @ts-check
// ⚠️ 此文件在执行 init 或首次自动初始化时会被强制覆盖，请勿直接修改。
// 如需自定义配置，请编辑 scriptData/example/config.js（由 loadUserConfig 自动创建）。
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
     *   taskTimeoutMs: number,
     * }}
     */
    const defaultConfig = {
        // 任务超时时间（毫秒），0 表示使用全局默认
        taskTimeoutMs: 2 * 60 * 1000,
    };

    return { ...defaultConfig, ...userConfig };
};
