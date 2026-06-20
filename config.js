// config.js
// 全局配置文件，优先于平台自动匹配

module.exports = {
    // chromePath: "", // （弃用）浏览器路径，优先使用此配置，为空则自动匹配平台
    // Puppeteer launch 参数
    puppeteerArgs: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // "--window-size=640,480",
        "--mute-audio",
        "--disable-session-crashed-bubble",
        "--disable-gpu",
        "--use-gl=swiftshader",
        "--disable-gpu-compositing",
    ],
    // 默认登录页
    defaultLoginUrl: "https://www.migufun.com/middleh5/",
    // 默认UA
    mobileUA:
        "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
    // 默认视口
    viewport: {
        width: 640,
        height: 480,
        hasTouch: true,
        isLandscape: true,
    },
    pageloadOptions: {
        waitUntil: "load",
        timeout: 60000,
    },
    // 截图功能配置
    screenshots: {
        // 是否启用自动定时截图（true=启用, false=禁用）
        autoScreenshotEnabled: true,
        // 自动截图间隔（毫秒），默认 30 秒
        autoScreenshotInterval: 30000,
        // 是否在日志事件时触发截图（true=启用, false=禁用）
        screenshotOnLog: true,
        // 截图节流&超时时间（毫秒），同一秒内限一张截图
        screenshotThrottleMs: 2500,
    },
    // 自动化行为配置
    automation: {
        // 默认任务超时时间（毫秒），默认 30 分钟
        defaultTaskTimeoutMs: 1800000,
        // 默认拖拽模拟步数
        defaultDragSteps: 20,
        // 默认拖拽持续时间（毫秒）
        defaultDragDuration: 500,
    },
    // 目录配置
    dirs: {
        // 日志目录基础名称
        logDirBase: "logs",
        // 用户数据目录名称
        userDataDirName: "user-data",
    },
};
