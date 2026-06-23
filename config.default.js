// 警告：不建议直接修改此文件，请通过同目录下的 config.user.js 进行自定义配置。
const loadUserConfig = require("./loadUserConfig");

const userConfig = loadUserConfig(__filename, "用户自定义全局配置");

// 开发模式检测：设置环境变量 AUTOGAMER_DEV=1 或 NODE_ENV=development 可进入开发模式
// 开发模式下会自动禁用定时自动截屏、日志文件写入，且脚本不会自动执行 main 函数
const isDev =
    process.env.AUTOGAMER_DEV === "1" || process.env.NODE_ENV === "development";

// 非开发模式下是否启用自动定时截屏，用户按需修改
const autoScreenshotEnabled = true;
// 非开发模式下是否启用日志事件截图，用户按需修改
const screenshotOnLog = true;
// 是否始终隐藏遮罩层（true=始终隐藏, false=跟随鼠标移入移出）
const alwaysHideOverlay = true;

const defaultConfig = {
    isDev,
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
        // 开发模式下强制禁用，非开发模式跟随顶层 autoScreenshotEnabled 配置
        autoScreenshotEnabled: isDev ? false : autoScreenshotEnabled,
        // 自动截图间隔（毫秒），默认 30 秒
        autoScreenshotInterval: 30000,
        // 是否在日志事件时触发截图（true=启用, false=禁用）
        screenshotOnLog: isDev ? false : screenshotOnLog,
        // 截图节流&超时时间（毫秒），同一秒内限一张截图；超时时间会预留 100 ms用于处理遮罩层
        screenshotThrottleMs: 2500,
    },
    // 自动化行为配置
    automation: {
        // 默认任务超时时间（毫秒），默认 30 分钟
        defaultTaskTimeoutMs: 30 * 60 * 1000,
        // 默认拖拽模拟步数
        defaultDragSteps: 20,
        // 默认拖拽持续时间（毫秒）
        defaultDragDuration: 500,
    },
    // 是否始终隐藏遮罩层（true=始终隐藏, false=跟随鼠标移入移出）
    alwaysHideOverlay: isDev ? true : alwaysHideOverlay,
    // 目录配置
    dirs: {
        // 日志目录基础名称
        logDirBase: "logs",
        // 用户数据目录名称
        userDataDirName: "user-data",
    },
};

module.exports = { ...defaultConfig, ...userConfig };
