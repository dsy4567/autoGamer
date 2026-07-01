const puppeteer = require("puppeteer-core");
const readline = require("readline");
const path = require("path");
const fs = require("fs");
const os = require("os");
const config = require("./config.default.js");
const { createUtils } = require("./utils.js");

// 日志增强钩子，初始为空函数，后续赋值以启用写文件
let _logWriteFile = () => {};

// 日志工具（只定义一次，通过钩子变量控制增强行为）
/** 输出日志并触发写文件钩子 @param {...any} args */
const log = (...args) => {
    const now = new Date().toISOString();
    console.log(`[${now}]`, ...args);
    _logWriteFile(now, args);
};
// 原始日志，不触发截图钩子，供截图函数自身使用以避免递归
const logRaw = (...args) => {
    const now = new Date().toISOString();
    console.log(`[${now}]`, ...args);
    _logWriteFile(now, args);
};

// 全局错误处理：捕获未捕获的异常和未处理的 Promise 拒绝
let _errorLogFile = null;

process.on("uncaughtException", err => {
    // 例外：允许使用 console.error 而不是 log/logRaw
    console.error("ERROR: 未捕获的异常:", err);
    if (_errorLogFile) {
        try {
            fs.appendFileSync(
                _errorLogFile,
                `[${new Date().toISOString()}] ERROR: 未捕获的异常: ${err.stack || err}\n`,
            );
        } catch (e) {}
    }
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    // 例外：允许使用 console.error 而不是 log/logRaw
    console.error("ERROR: 未处理的 Promise 拒绝:", reason);
    if (_errorLogFile) {
        try {
            fs.appendFileSync(
                _errorLogFile,
                `[${new Date().toISOString()}] ERROR: 未处理的 Promise 拒绝: ${reason?.stack || reason}\n`,
            );
        } catch (e) {}
    }
    process.exit(1);
});

/**
 * 注入 inject.js 到页面
 * @param {import("puppeteer-core").Page} page
 */
async function inject(page) {
    const injectPath = path.resolve(__dirname, "inject.js");
    if (fs.existsSync(injectPath)) {
        try {
            // 将全局配置注入页面，供 inject.js 读取
            await page.evaluate(alwaysHideOverlay => {
                window.__autoGamerConfig = { alwaysHideOverlay };
            }, config.alwaysHideOverlay ?? false);
            await page.mainFrame().addScriptTag({ path: injectPath });
            log("已注入 inject.js");
        } catch (e) {
            log("ERROR: inject.js 注入失败:", e.message);
        }
    } else {
        log("ERROR: inject.js 文件不存在，未注入");
    }
}

const MOBILE_UA =
    "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";

async function main() {
    const arg = process.argv[2];
    if (!arg || arg === "-h" || arg === "--help") {
        // 例外：允许使用 console.log 而不是 log/logRaw
        console.log(`
基于 Puppeteer 的自动化游戏工具
Copyright (c) 2025~2026 dsy4567, MIT License
版本 1.0.0

用法: node index.js [选项] <命令/脚本>

命令:
  login [URL]           打开登录页面（默认 URL 可配置）
  <操作脚本.js>         执行指定的自动化脚本

选项:
  -h, --help            显示此帮助信息
  --start-at <描述链>    前面的描述链辅助定位，从最后一个描述开始执行 action
  --end-at <描述链>      前面的描述链辅助定位，到最后一个描述停止执行 action

描述链格式: 描述1#描述2，以半角 # 分隔

示例:
  node index.js s/sr.js
  node index.js s/sr.js --start-at "开始挑战#waitSceneChange"
  node index.js s/sr.js --end-at "进入生存索引"
  node index.js s/zzz.js --start-at "点击前往#进入咖啡店" --end-at "点击确认"
  node index.js login
`);
        process.exit(arg ? 0 : 1);
    }

    // 推导脚本名，用于日志目录
    const scriptName = (() => {
        if (!arg) return "unknown";
        if (arg === "login") return "_login";
        const ext = path.extname(arg);
        if (ext) return path.basename(arg, ext);
        return "unknown";
    })();
    const startTimeStr = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_");
    const logDir = config.isDev
        ? path.resolve(__dirname, "logs", "devTemp")
        : path.resolve(__dirname, "logs", scriptName, startTimeStr);
    fs.mkdirSync(logDir, { recursive: true });
    if (!config.isDev) {
        const logFilePath = path.join(logDir, "log.txt");

        // 启用日志写入文件
        _errorLogFile = logFilePath;
        _logWriteFile = (now, args) => {
            try {
                fs.appendFileSync(
                    logFilePath,
                    `[${now}] ${args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}\n`,
                );
            } catch (e) {}
        };
    }

    // 获取本地浏览器路径
    // const executablePath = getLocalChromePath();
    // if (!executablePath || !fs.existsSync(executablePath)) {
    //     log("未找到本地浏览器，请检查路径:", executablePath);
    //     process.exit(1);
    // }
    // log("使用本地浏览器:", executablePath);

    // 启动 Puppeteer
    log("启动浏览器...");
    const userDataDir = path.resolve(
        __dirname,
        config.dirs?.userDataDirName ?? "user-data",
    );
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: {
            ...(config.viewport ?? {
                width: 640,
                height: 480,
                hasTouch: true,
                isLandscape: true,
            }),
        },
        channel: "chrome",
        userDataDir,
        args: config.puppeteerArgs ?? [
            "--no-sandbox",
            "--disable-setuid-sandbox",

            "--disable-gpu",
            "--use-gl=swiftshader",
            "--disable-gpu-compositing",

            "--mute-audio",
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
            "--disable-sync", // 禁用Chrome同步功能
        ],
    });
    browser.on("disconnected", () => {
        log("所有浏览器窗口已关闭，程序退出");
        process.exit(0);
    });
    const [page] = await browser.pages();
    await page.setUserAgent(config.mobileUA ?? MOBILE_UA);
    log("已设置移动端UA");
    const pageOpenTime = Date.now();

    page.on("load", () => {
        log(
            "网页完全加载，用时:",
            Date.now() - pageOpenTime,
            "毫秒",
            page.url(),
        );
    });

    const utils = createUtils(
        {
            puppeteer,
            browser,
            page,
            log,
            logRaw,
            pageOpenTime,
            logDir,
        },
        code => eval(code),
    );
    const {
        ts,
        te,
        tm,
        tt,
        pc,
        hold,
        sleep,
        drag,
        screenshot,
        startAutoScreenshot,
        startRepl,
        setTaskTimeout,
    } = utils;

    // 监听页面 postMessage 事件，自动模拟 tap/drag/hold
    await page.exposeFunction("__autoGamerSimulateTouch", async msg => {
        if (!msg || typeof msg !== "object" || !msg.type) return;
        if (msg.type === "auto-gamer-mouse-to-tap") {
            log("收到 tap 事件，位置:", msg.x, msg.y);
            try {
                await tt(msg.x, msg.y);
            } catch (e) {
                log("ERROR: tap 执行失败:", e.message);
            }
        } else if (msg.type === "auto-gamer-mouse-to-drag") {
            log(
                "收到 drag 事件，从:",
                msg.from,
                "到:",
                msg.to,
                "持续时间:",
                msg.duration,
            );
            try {
                await drag(
                    msg.from.x,
                    msg.from.y,
                    msg.to.x,
                    msg.to.y,
                    msg.duration,
                );
            } catch (e) {
                log("ERROR: drag 执行失败:", e.message);
            }
        } else if (msg.type === "auto-gamer-mouse-to-hold") {
            log(
                "收到 hold 事件，位置:",
                msg.x,
                msg.y,
                "持续时间:",
                msg.duration,
            );
            try {
                await hold(msg.x, msg.y, msg.duration);
            } catch (e) {
                log("ERROR: hold 执行失败:", e.message);
            }
        }
    });
    await page.evaluateOnNewDocument(() => {
        window.addEventListener("message", ev => {
            if (
                ev &&
                ev.data &&
                (ev.data.type === "auto-gamer-mouse-to-tap" ||
                    ev.data.type === "auto-gamer-mouse-to-drag" ||
                    ev.data.type === "auto-gamer-mouse-to-hold")
            ) {
                // 通过 puppeteer 暴露的函数转发到 Node 端
                window.__autoGamerSimulateTouch(ev.data);
            }
        });
    });

    if (arg === "login") {
        // 支持 node index.js login [url]
        let loginUrl =
            config.defaultLoginUrl ?? "https://www.migufun.com/middleh5/";
        // 允许 node index.js login https://xxx
        const url = process.argv.at(-1);
        try {
            loginUrl = new URL(url).toString();
        } catch (e) {
            log("WARNING: 未指定/无效的 URL，使用配置或默认登录页");
        }
        log(`打开登录页面: ${loginUrl}`);
        await page.goto(loginUrl, config.pageloadOptions);
        await inject(page);
        log("请在浏览器中完成登录操作，完成后关闭页面即可退出");

        // 每次跳转后自动注入
        page.on("framenavigated", async () => {
            await inject(page);
        });
        await startRepl();
    } else {
        // 执行操作脚本
        let scriptPath = path.resolve(arg);
        if (!fs.existsSync(scriptPath)) {
            log("ERROR: 找不到操作脚本:", scriptPath);
            process.exit(1);
        }
        log("加载操作脚本:", scriptPath);
        // 传递 puppeteer, browser, page, log 给脚本
        const script = require(scriptPath);
        if (typeof script !== "function") {
            log("ERROR: 脚本文件需导出一个 async function");
            process.exit(1);
        }
        try {
            page.on("load", async () => {
                await inject(page);
            });

            await script({
                puppeteer,
                browser,
                page,
                log,
                logRaw,
                pageOpenTime,
                logDir,
                getGlobalConfig: () => config,
                createUtils,
            });
        } catch (e) {
            log("ERROR: 脚本执行出错:", e);
        }
        // 每次跳转后自动注入
        page.on("framenavigated", async () => {
            await inject(page);
        });
    }
}

main();
