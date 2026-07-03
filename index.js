// @ts-check

const puppeteer = require("puppeteer-core");
// @ts-ignore
const readline = require("readline");
const path = require("path");
const fs = require("fs");
// @ts-ignore
const os = require("os");
const { parseArgs } = require("util");
const config = require("./config.default.js");
const { createUtils } = require("./utils.js");
const loadUserConfig = require("./loadUserConfig");

/** 日志增强钩子，初始为空函数，后续赋值以启用写文件 @type {(now: string, args: any[]) => void} */
let _logWriteFile = () => {};

// 日志工具（只定义一次，通过钩子变量控制增强行为）
/** 输出日志并触发写文件钩子 @param {...any} args */
const log = (...args) => {
    const now = new Date().toISOString();
    console.log(`[${now}]`, ...args);
    _logWriteFile(now, args);
};
/** 原始日志，不触发截图钩子，供截图函数自身使用以避免递归 @param {...any} args */
const logRaw = (...args) => {
    const now = new Date().toISOString();
    console.log(`[${now}]`, ...args);
    _logWriteFile(now, args);
};

/** 全局错误处理：捕获未捕获的异常和未处理的 Promise 拒绝 @type {string | null} */
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

// @ts-ignore
process.on("unhandledRejection", (reason, promise) => {
    // 例外：允许使用 console.error 而不是 log/logRaw
    console.error("ERROR: 未处理的 Promise 拒绝:", reason);
    if (_errorLogFile) {
        try {
            fs.appendFileSync(
                _errorLogFile,
                // @ts-ignore
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
                // @ts-ignore
                window.__autoGamerConfig = { alwaysHideOverlay };
            }, config.alwaysHideOverlay ?? false);
            await page.mainFrame().addScriptTag({ path: injectPath });
            log("已注入 inject.js");
        } catch (e) {
            log("ERROR: inject.js 注入失败:", e);
        }
    } else {
        log("ERROR: inject.js 文件不存在，未注入");
    }
}

const MOBILE_UA =
    "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";

/**
 * 强制覆盖单个文件
 * @param {string} src
 * @param {string} dest
 */
function copyForce(src, dest) {
    fs.cpSync(src, dest, { force: true });
}

/**
 * 强制覆盖整个目录（递归合并覆盖，不删除目标中额外文件）
 * @param {string} src
 * @param {string} dest
 */
function copyDirForce(src, dest) {
    fs.cpSync(src, dest, { recursive: true, force: true });
}

/**
 * 执行 init 命令：创建数据目录、各脚本的 logs/scriptData 子目录，并强制覆盖 README/share/scripts
 * @param {string} sourceDir 项目内 userData.default 源目录
 * @param {string} dataDir 数据目录
 */
function runInit(sourceDir, dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });

    // 扫描源 scripts 目录，为每个脚本创建 logs/<id>/、scriptData/<id>/
    const scriptsSrc = path.join(sourceDir, "scripts");
    if (fs.existsSync(scriptsSrc)) {
        for (const id of fs.readdirSync(scriptsSrc)) {
            if (fs.statSync(path.join(scriptsSrc, id)).isDirectory()) {
                ["logs", "scriptData"].forEach(dir => {
                    fs.mkdirSync(path.join(dataDir, dir, id), {
                        recursive: true,
                    });
                });
            }
        }
    }

    // 强制覆盖 README.md、share/、scripts/、autoGamer.d.ts（源=目标时跳过，避免递归）
    if (path.resolve(sourceDir) !== path.resolve(dataDir)) {
        const items = ["README.md", "share", "scripts", "autoGamer.d.ts"];
        items.forEach(item => {
            const src = path.join(sourceDir, item);
            const dest = path.join(dataDir, item);
            item === "README.md"
                ? copyForce(src, dest)
                : copyDirForce(src, dest);
        });
        log("初始化完成:", dataDir);
    } else {
        log("开发模式：数据目录与源目录相同，跳过复制，仅创建子目录:", dataDir);
    }
}

/**
 * 非开发模式自动初始化：数据目录不存在时创建并复制内置文件
 * @param {string} sourceDir 项目内 userData.default 源目录
 * @param {string} dataDir 数据目录
 * @param {string|null} scriptId 当前脚本 id（login 时为 null）
 */
function ensureDataDir(sourceDir, dataDir, scriptId) {
    const items = ["README.md", "share", "scripts", "autoGamer.d.ts"];

    if (items.some(item => !fs.existsSync(path.join(dataDir, item)))) {
        fs.mkdirSync(dataDir, { recursive: true });
        items.forEach(item => {
            const src = path.join(sourceDir, item);
            const dest = path.join(dataDir, item);
            item === "README.md"
                ? copyForce(src, dest)
                : copyDirForce(src, dest);
        });
        log("已初始化数据目录:", dataDir);
    }

    if (scriptId) {
        ["logs", "scriptData"].forEach(dir => {
            fs.mkdirSync(path.join(dataDir, dir, scriptId), {
                recursive: true,
            });
        });
        log("已初始化脚本相关目录:", scriptId);
    }
}

async function main() {
    const { values, positionals } = parseArgs({
        options: {
            help: { type: "boolean", short: "h" },
            "start-at": { type: "string" },
            "end-at": { type: "string" },
        },
        allowPositionals: true,
    });
    const arg = positionals[0];
    if (values.help || !arg) {
        // 例外：允许使用 console.log 而不是 log/logRaw
        console.log(`
autoGamer - 基于 Puppeteer 的自动化游戏工具
Copyright (c) 2025~2026 dsy4567, MIT License
版本 1.0.0

用法: node index.js [选项] <命令>

命令:
  init                  初始化数据目录（开发模式为 userData.default/，否则为 ~/.autoGamer/）
  login [URL]           打开登录页面（默认 URL 可配置）
  <脚本id>              执行指定的自动化脚本（如 sr、zzz、example）

选项:
  -h, --help            显示此帮助信息
  --start-at <描述链>    前面的描述链辅助定位，从最后一个描述开始执行 action（仅对 <脚本id> 有效）
  --end-at <描述链>      前面的描述链辅助定位，到最后一个描述停止执行 action（仅对 <脚本id> 有效）

描述链格式: 描述1#描述2，以半角 # 分隔

示例:
  node index.js init
  node index.js login
  node index.js sr
  node index.js sr --start-at "开始挑战#waitSceneChange"
  node index.js sr --end-at "进入生存索引"
  node index.js zzz --start-at "点击前往#进入咖啡店" --end-at "点击确认"
`);
        process.exit(values.help ? 0 : 1);
    }

    // 解析 --start-at / --end-at 描述链
    const startAtChain = values["start-at"]
        ? values["start-at"].split("#")
        : null;
    const endAtChain = values["end-at"] ? values["end-at"].split("#") : null;

    // 命令判定：init / login / <脚本id> 三者互斥
    const command = arg;
    const isInit = command === "init";
    const isLogin = command === "login";
    const scriptId = !isInit && !isLogin ? command : null;

    if ((startAtChain || endAtChain) && !scriptId) {
        log(
            "WARNING: --start-at / --end-at 仅在运行脚本时生效，当前命令已忽略",
        );
    }

    // 源数据目录（项目内 userData.default/），用于 init/自动初始化时复制文件
    const sourceDir = path.resolve(__dirname, "userData.default");
    const dataDir = config.dataDir;

    // init 命令：初始化数据目录后退出
    if (isInit) {
        runInit(sourceDir, dataDir);
        process.exit(0);
    }

    // 非开发模式自动初始化：首次运行时创建数据目录并复制内置文件
    if (!config.isDev) {
        ensureDataDir(sourceDir, dataDir, scriptId);
    }

    // 推导脚本名，用于日志目录
    const scriptName = isLogin ? "_login" : (scriptId ?? "unknown");
    const startTimeStr = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_");
    const logDir = config.isDev
        ? path.join(dataDir, "logs", "devTemp")
        : path.join(dataDir, "logs", scriptName, startTimeStr);
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
    const userDataDir =
        config.dirs?.chromeDataDir ?? path.join(config.dataDir, "chromeData");
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
            startAtChain,
            endAtChain,
        },
        (/** @type {string} */ code) => eval(code),
    );
    const {
        // @ts-ignore
        ts,
        // @ts-ignore
        te,
        // @ts-ignore
        tm,
        tt,
        // @ts-ignore
        pc,
        hold,
        // @ts-ignore
        sleep,
        drag,
        // @ts-ignore
        screenshot,
        // @ts-ignore
        startAutoScreenshot,
        startRepl,
        // @ts-ignore
        setTaskTimeout,
    } = utils;

    // 监听页面 postMessage 事件，自动模拟 tap/drag/hold
    await page.exposeFunction(
        "__autoGamerSimulateTouch",
        async (
            /** @type {{ type: string; x: number; y: number; from: { x: number; y: number; }; to: { x: number; y: number; }; duration: number | undefined; }} */ msg,
        ) => {
            if (!msg || typeof msg !== "object" || !msg.type) return;
            if (msg.type === "auto-gamer-mouse-to-tap") {
                log("收到 tap 事件，位置:", msg.x, msg.y);
                try {
                    await tt(msg.x, msg.y);
                } catch (e) {
                    log("ERROR: tap 执行失败:", e);
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
                    log("ERROR: drag 执行失败:", e);
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
                    log("ERROR: hold 执行失败:", e);
                }
            }
        },
    );
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
                // @ts-ignore
                window.__autoGamerSimulateTouch(ev.data);
            }
        });
    });

    if (isLogin) {
        // 支持 node index.js login [url]
        let loginUrl =
            config.defaultLoginUrl ?? "https://www.migufun.com/middleh5/";
        // 允许 node index.js login https://xxx
        const url = positionals[1];
        if (url) {
            try {
                loginUrl = new URL(url).toString();
            } catch (e) {
                log("WARNING: 无效的 URL，使用配置或默认登录页");
            }
        }
        log(`打开登录页面: ${loginUrl}`);
        // @ts-ignore
        await page.goto(loginUrl, config.pageloadOptions);
        await inject(page);
        log("请在浏览器中完成登录操作，完成后关闭页面即可退出");

        // 每次跳转后自动注入
        page.on("framenavigated", async () => {
            await inject(page);
        });
        await startRepl();
    } else {
        // 执行操作脚本（按脚本 id 解析）
        // @ts-ignore
        const scriptPath = path.join(dataDir, "scripts", scriptId, "main.js");
        if (!fs.existsSync(scriptPath)) {
            log("ERROR: 找不到脚本:", scriptPath);
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
                loadUserConfig,
                dataDir,
                scriptId,
                startAtChain,
                endAtChain,
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
