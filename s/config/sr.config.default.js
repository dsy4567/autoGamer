// 警告：不建议直接修改此文件，请通过同目录下的 sr.config.user.js 进行自定义配置。
const loadUserConfig = require("../../loadUserConfig");

const userConfig = loadUserConfig(__filename);

const defaultConfig = {
    // 游戏启动 URL（咪咕快游平台）
    gameUrl:
        "https://www.migufun.com/miguplay/middleGame/gameplay/400803874?gameName=%E5%B4%A9%E5%9D%8F%EF%BC%9A%E6%98%9F%E7%A9%B9%E9%93%81%E9%81%93",
    // 任务超时时间（毫秒），默认 30 分钟
    taskTimeoutMs: 30 * 60 * 1000,
    // 副本类型: 1=经验书, 2=武器矿, 3=钞票, 4=培养目标首个副本
    dungeonType: 2,
    // 副本预计战斗时长（秒）
    dungeonFightTime: 420,
    // 启动阶段延时配置（毫秒）
    startupDelays: {
        // 等待页面初始加载
        initialWait: 40 * 1000,
        // 同意用户协议后等待
        afterAgreement: 90 * 1000,
        // 点击开始游戏后等待读条
        afterStartGame: 30 * 1000,
    },
};

module.exports = { ...defaultConfig, ...userConfig };
