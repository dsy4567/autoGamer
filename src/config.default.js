/**
 * @fileoverview 默认全局配置及加载用户自定义配置
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check
"use strict";

// 警告：不建议直接修改此文件，请通过 <数据目录>/globalConfig.js 进行自定义配置。
// 数据目录：开发模式为项目内 userData.default/，非开发模式为 ~/.autoGamer/
const os = require("os");
const path = require("path");
const loadUserConfig = require("./loadUserConfig");

/** @type {AutoGamer.GlobalConfig["isDev"]} */
let isDev = process.argv.includes("--dev")
    ? 2
    : process.env.AUTOGAMER_DEV === "1" ||
        process.env.NODE_ENV === "development"
      ? 1
      : 0;

// 数据目录：开发模式（贡献者）使用项目内 userData.default/，非开发模式使用 ~/.autoGamer/
const dataDir =
    isDev === 1
        ? path.resolve(__dirname, "../userData.default")
        : path.resolve(os.homedir(), ".autoGamer");

const userConfig = loadUserConfig(path.join(dataDir, "globalConfig.js"), {
    dataDir,
    scriptId: "_globalConfig",
});

// 非开发模式下是否启用自动定时截屏，用户按需修改
const autoScreenshotEnabled = true;
// 非开发模式下是否启用日志事件截图，用户按需修改
const screenshotOnLog = true;
// 是否始终隐藏遮罩层（true=始终隐藏, false=跟随鼠标移入移出）
const alwaysHideOverlay = true;

/** @type {AutoGamer.GlobalConfig} */
const defaultConfig = {
    /** 开发模式类型
     *
     * 开发模式下会自动禁用定时自动截屏、日志文件写入，且脚本不会自动执行 main 函数
     *
     * 0: 关闭开发模式
     * 1: 开启开发模式（供项目贡献者使用，改变数据目录为 .userData.default/）
     * 2: 开启开发模式（继续使用数据目录 ~/.autoGamer/）
     *
     */
    isDev,
    /** 数据目录（开发模式为项目内 userData.default/，非开发模式为 ~/.autoGamer/） */
    dataDir,
    /** Chrome 可执行文件路径（默认自动寻找已安装的 Chrome 浏览器） */
    chromeExecPath: null,
    /** Puppeteer 启动参数 */
    puppeteerArgs: [
        "--no-sandbox",
        "--disable-setuid-sandbox",

        "--disable-gpu",
        "--use-gl=swiftshader",
        "--disable-gpu-compositing",

        // "--mute-audio",
        "--password-store=basic",

        "--deny-permission-prompts", // 自动拒绝权限请求，不弹出确认框
        "--hide-crash-restore-bubble", // 隐藏崩溃恢复气泡
        "--disable-background-timer-throttling", // 禁用后台标签页计时器节流，保证setTimeout/setInterval在后台正常运行
        "--disable-backgrounding-occluded-windows", // 禁用窗口被遮挡时降低优先级，保持页面活跃
        "--disable-breakpad", // 禁用崩溃报告系统，减少额外进程和上报
        "--disable-component-update", // 禁用组件自动更新，避免后台下载和重启
        "--disable-default-apps", // 禁用默认应用
        "--disable-extensions", // 禁用所有扩展，防止扩展干扰和占用资源
        "--disable-external-intent-requests", // 禁止外部意图请求，避免跳转其他应用
        "--disable-features=TranslateUI,InterestFeedContentSuggestions,CalculateNativeWinOcclusion,GlobalMediaControls", // 禁用翻译UI、内容推荐、窗口遮挡计算、全局媒体控制
        "--disable-hang-monitor", // 禁用无响应监控，防止长时间脚本被终止
        "--disable-plugins", // 禁用NPAPI插件
        "--disable-renderer-backgrounding", // 禁用渲染器后台化
        "--disable-restore-session-state", // 禁用会话恢复
        "--disable-sync", // 禁用Chrome同步功能
    ],
    /** 默认登录页 */
    defaultLoginUrl: "https://www.migufun.com/middleh5/",
    /** 默认UA */
    mobileUA:
        "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36",
    /** 默认视口 */
    viewport: {
        // WARN: 不要修改默认宽高
        width: 640,
        height: 480,
        hasTouch: true,
        isLandscape: true,
    },
    /** 页面加载选项 */
    pageloadOptions: {
        waitUntil: "load",
        timeout: 60000,
    },
    /** 截图功能配置 */
    screenshots: {
        /** 是否启用自动定时截图（true=启用, false=禁用）
        开发模式下强制禁用，非开发模式跟随顶层 autoScreenshotEnabled 配置 */
        autoScreenshotEnabled: isDev ? false : autoScreenshotEnabled,
        /** 自动截图间隔（毫秒），默认 30 秒 */
        autoScreenshotInterval: 30000,
        /** 是否在日志事件时触发截图（true=启用, false=禁用） */
        screenshotOnLog: isDev ? false : screenshotOnLog,
        /** 截图节流&超时时间（毫秒），同一秒内限一张截图；超时时间会预留 100 ms用于处理遮罩层 */
        screenshotThrottleMs: 750,
    },
    /** 自动化行为配置 */
    automation: {
        /** 默认任务超时时间（毫秒），默认 30 分钟 */
        defaultTaskTimeoutMs: 30 * 60 * 1000,
        /** 默认拖拽模拟步数 */
        defaultDragSteps: 20,
        /** 默认拖拽持续时间（毫秒） */
        defaultDragDuration: 500,
    },
    /** 是否始终隐藏遮罩层（true=始终隐藏, false=跟随鼠标移入移出） */
    alwaysHideOverlay: isDev ? true : alwaysHideOverlay,
    /** 目录配置 */
    dirs: {
        /** Chrome 用户数据目录（浏览器自动创建） */
        chromeDataDir: path.join(dataDir, "chromeData"),
    },
    /** 日志文件夹数量警告阈值，logs/ 下所有脚本子目录中文件夹总数超过此值时，退出时提醒清理 */
    logCleanupWarningThreshold: 50,
    /** 游戏版本更新日是否运行脚本 */
    forceRun: false,
    /** 检测到源文件变化时是否自动同步到数据目录（true=自动同步, false=仅警告并提示执行 init） */
    autoSyncSourceFiles: true,
    /** 检查点处理函数，可能被脚本调用 */
    checkpoint: async (desc, ctx, ...args) => {
        ctx.log(
            "提示: 已触发检查点，可修改全局配置文件以自定义检查点行为，当前检查点行为为仅打印日志",
            desc,
            ...args,
        );
    },
};

module.exports = { ...defaultConfig, ...userConfig };
