// @ts-check

const path = require("path");
const fs = require("fs");
const { parseArgs } = require("util");
const config = require("./config.default.js");
const { createUtils } = require("./utils.js");
const loadUserConfig = require("./loadUserConfig");

/** 日志增强钩子，初始为空函数，后续赋值以启用写文件 @type {(now: string, str: string) => void} */
let _logWriteFile = () => {};
/** 日志增强钩子，初始为空函数，后续赋值在网页展示日志 @type {(str: string) => void} */
let _logWriteHtml = () => {};

// 日志工具（只定义一次，通过钩子变量控制增强行为）
/** 输出日志并触发写文件钩子 @param {...any} args */
const log = (...args) => {
    const now = new Date().toISOString();
    console.log(`[${now}]`, ...args);
    const str = args
        .map(a => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");
    _logWriteFile(now, str);
    _logWriteHtml(str);
};
/** 原始日志，不触发截图钩子，供截图函数自身使用以避免递归 @param {...any} args */
const logRaw = (...args) => {
    const now = new Date().toISOString();
    console.log(`[${now}]`, ...args);
    const str = args
        .map(a => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");
    _logWriteFile(now, str);
    _logWriteHtml(str);
};

/** 退出时要输出的警告消息 @type {string[]} */
const _exitWarnings = [];

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

// 退出时输出警告消息
function _printExitWarnings() {
    if (_exitWarnings.length > 0) {
        for (const warning of _exitWarnings) {
            log("WARNING:", warning);
        }
    }
}

process.on("exit", _printExitWarnings);
process.on("SIGINT", () => {
    _printExitWarnings();
    process.exit(1);
});
process.on("SIGTERM", () => {
    _printExitWarnings();
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

    // 强制覆盖（源=目标时跳过，避免递归）
    if (path.resolve(sourceDir) !== path.resolve(dataDir)) {
        const dirs = ["share", "scripts"];
        const files = ["README.md", "autoGamer.d.ts"];
        const items = [...dirs, ...files];
        items.forEach(item => {
            const src = path.join(sourceDir, item);
            const dest = path.join(dataDir, item);
            files.includes(item)
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
    if (config.isDev === 1) return;

    // 仅操作和特定脚本有关的目录和文件
    const dirs = [
        "share",
        ...(scriptId ? [path.join("scripts", scriptId)] : []),
    ];
    /** @type {string[]}  */
    const files = [
        ...(scriptId
            ? [
                  path.join("scripts", scriptId, "main.js"),
                  path.join("scripts", scriptId, "config.default.js"),
              ]
            : []),
    ];
    const items = [...dirs, ...files];

    if (items.some(item => !fs.existsSync(path.join(dataDir, item)))) {
        log("WARNING: 相关目录不存在，正在初始化");
        fs.mkdirSync(dataDir, { recursive: true });
        items.forEach(item => {
            const src = path.join(sourceDir, item);
            const dest = path.join(dataDir, item);
            dirs.includes(item) && copyDirForce(src, dest);
        });
        log("已初始化数据目录:", dataDir);
    }
}

async function main() {
    const { values, positionals } = parseArgs({
        options: {
            help: { type: "boolean", short: "h" },
            dev: { type: "boolean" },
            "force-run": { type: "boolean" },
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
  --dev                 进入开发模式，禁用定时自动截屏、日志文件写入等功能，视脚本可能不会自动执行 main 函数

作用视脚本而定的选项:
  --start-at <描述链>    前面的描述链辅助定位，从最后一个描述开始执行 action（仅对 <脚本id> 有效）
  --end-at <描述链>      前面的描述链辅助定位，到最后一个描述停止执行 action（仅对 <脚本id> 有效）
  --force-run           强制运行脚本，忽略更新日等限制（仅对 <脚本id> 有效）

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

    // 非开发模式（贡献者）自动初始化：首次运行时创建数据目录并复制内置文件
    if (config.isDev !== 1) {
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
        _logWriteFile = (now, str) => {
            try {
                fs.appendFileSync(logFilePath, `[${now}] ${str}\n`);
            } catch (e) {}
        };
    }

    // 非开发模式：检查 logs/ 下所有脚本子目录的文件夹总数，超过阈值则提醒清理
    if (config.isDev !== 1) {
        const logsDir = path.join(dataDir, "logs");
        if (fs.existsSync(logsDir)) {
            let totalFolders = 0;
            for (const scriptDir of fs.readdirSync(logsDir)) {
                const scriptDirPath = path.join(logsDir, scriptDir);
                if (fs.statSync(scriptDirPath).isDirectory()) {
                    totalFolders += fs
                        .readdirSync(scriptDirPath)
                        .filter(name =>
                            fs
                                .statSync(path.join(scriptDirPath, name))
                                .isDirectory(),
                        ).length;
                }
            }
            const threshold = config.logCleanupWarningThreshold ?? 50;
            if (totalFolders > threshold) {
                _exitWarnings.push(
                    `logs/ 目录下共有 ${totalFolders} 个日志文件夹，超过阈值（${threshold} 个），建议清理旧日志以释放磁盘空间。日志目录: ${logsDir}`,
                );
            }
        }
    }

    // 启动 Puppeteer
    log("启动浏览器...");

    /** @type {import("puppeteer-core")} */
    let puppeteer;
    if (config.useStealth) {
        puppeteer = require("puppeteer-core");
    } else {
        // @ts-ignore
        puppeteer = require("puppeteer-extra");
        const StealthPlugin = require("puppeteer-extra-plugin-stealth");
        // @ts-ignore
        puppeteer.use(StealthPlugin());
    }

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
        args: config.puppeteerArgs,
    });
    browser.on("disconnected", () => {
        log("所有浏览器窗口已关闭，程序退出");
        process.exit(0);
    });
    const [page] = await browser.pages();
    await page.setUserAgent(config.mobileUA);
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
        compareScreenshot,
        action,
    } = utils;

    _logWriteHtml = async content => {
        try {
            await page.evaluate(content => {
                window.postMessage({
                    type: "auto-gamer-log",
                    content,
                });
            }, content);
        } catch (e) {}
    };
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
    await inject(page);
    page.on("framenavigated", async () => {
        await inject(page);
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
        await page.goto(loginUrl, config.pageloadOptions);
        log("请在浏览器中完成登录操作，完成后关闭页面即可退出");

        await startRepl();
    } else {
        // 执行操作脚本（按脚本 id 解析）
        if (!scriptId) {
            log("ERROR: 脚本 id 无效");
            process.exit(1);
        }

        const scriptPath = path.join(dataDir, "scripts", scriptId, "main.js");
        if (!fs.existsSync(scriptPath)) {
            log("ERROR: 找不到脚本:", scriptPath);
            process.exit(1);
        }

        log("加载操作脚本:", scriptPath);
        // 传递 puppeteer, browser, page, log 给脚本
        /** @type {AutoGamer.ScriptFunction} */
        const script = require(scriptPath);
        if (typeof script !== "function") {
            log("ERROR: 脚本文件需导出一个 async function");
            process.exit(1);
        }

        try {
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
    }
}

main();
