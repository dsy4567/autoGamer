// @ts-check
// 警告：不建议直接修改此文件，请通过同目录下的 example.config.user.js 进行自定义配置。
const loadUserConfig = require("../../loadUserConfig");

const userConfig = loadUserConfig(__filename);

/**
 * @type {{
 *   updateDates: string[],
 *   gameUrl: string,
 *   taskTimeoutMs: number,
 * }}
 */
const defaultConfig = {
    // 版本更新日期列表，格式 "YYYY-MM-DD"，匹配时拒绝运行
    updateDates: [],
    // 游戏启动 URL（咪咕快游平台）
    gameUrl:
        "https://www.migufun.com/miguplay/middleGame/gameplay/400007864?gameName=%E5%8E%9F%E7%A5%9E%C2%B7%E7%A9%BA%E6%9C%88%E4%B9%8B%E6%AD%8C",
    // 任务超时时间（毫秒），0 表示使用全局默认
    taskTimeoutMs: 0,
};

module.exports = { ...defaultConfig, ...userConfig };
