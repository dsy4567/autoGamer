// sr.config.js
// 崩坏：星穹铁道（Star Rail）脚本专用配置
// 脚本路径: s/sr.js

module.exports = {
    // 游戏启动 URL（咪咕快游平台）
    gameUrl:
        "https://www.migufun.com/miguplay/middleGame/gameplay/400803874?gameName=%E5%B4%A9%E5%9D%8F%EF%BC%9A%E6%98%9F%E7%A9%B9%E9%93%81%E9%81%93",
    // 任务超时时间（毫秒），默认 15 分钟
    taskTimeoutMs: 15 * 60 * 1000,
    // 副本类型: 1=经验书, 2=武器矿, 3=钞票
    dungeonType: 2,
    // 副本预计战斗时长（秒）
    dungeonFightTime: 360,
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
