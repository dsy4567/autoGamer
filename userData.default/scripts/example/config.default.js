// @ts-check
// ⚠️ 此文件在执行 init 或首次自动初始化时会被强制覆盖，请勿直接修改。
// 如需自定义配置，请编辑 scriptData/example/config.js（由 loadUserConfig 自动创建）。
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
     * }}
     */
    const defaultConfig = {
    // 版本更新时间列表，ISO 8601 格式（如 "2026-07-15T06:00:00+08:00"），更新后24h内拒绝运行
    updateDates: [],
    // 游戏启动 URL（咪咕快游平台）
    gameUrl:
        "https://www.migufun.com/miguplay/middleGame/gameplay/400007864?gameName=%E5%8E%9F%E7%A5%9E%C2%B7%E7%A9%BA%E6%9C%88%E4%B9%8B%E6%AD%8C",
    // 任务超时时间（毫秒），0 表示使用全局默认
    taskTimeoutMs: 0,
};

    return { ...defaultConfig, ...userConfig };
};
