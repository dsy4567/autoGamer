// config.js
// 全局配置文件，优先于平台自动匹配

module.exports = {
    // 浏览器路径，优先使用此配置
    chromePath: "", // 为空则自动匹配平台
    // Puppeteer launch 参数
    puppeteerArgs: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // "--window-size=640,480",
        "--mute-audio",
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
};
