#!/usr/bin/env node

/**
 * @fileoverview autoGamer 主程序，负责初始化环境、运行脚本等。
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check
"use strict";

const path = require("path");
const fs = require("fs");
const { parseArgs } = require("util");
const config = require("./config.default.js");
const { createUtils, formatLocalTimeWithTz } = require("./utils.js");
const loadUserConfig = require("./loadUserConfig");

/** 日志增强钩子，初始为空函数，后续赋值以启用写文件 @type {(now: string, str: string) => void} */
let _logWriteFile = () => {};
/** 日志增强钩子，初始为空函数，后续赋值在网页展示日志 @type {(str: string) => void} */
let _logWriteHtml = () => {};

/** 浏览器实例引用，用于退出前关闭 @type {import("puppeteer-core").Browser | null} */
let _browser = null;
/** 是否正在主动关闭浏览器，防止 disconnected 事件重复退出 @type {boolean} */
let _isExiting = false;

// ============ 热重载相关状态 ============
/** 当前脚本实例 @type {AutoGamer.InstanceInfo | null} */
let _currentInstance = null;
/** 上一次热重载时间戳，用于 5s 冷却 */
let _lastReloadTime = 0;
/** 是否正在执行热重载清理 */
let _isReloading = false;
/** 触发重载的 resolve @type {(() => void) | null} */
let _reloadResolve = null;
/** 等待重载的 Promise @type {Promise<void> | null} */
let _reloadPromise = null;

/**
 * 创建新的脚本实例
 * @param {boolean} isHotReload
 * @returns {AutoGamer.InstanceInfo}
 */
function _createInstance(isHotReload) {
    const instance = {
        instanceId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        isDestroyed: false,
        isHotReload,
        hotReloadEnabled: false,
        cleanupFunctions: [],
        enableHotReload() {
            if (!config.isDev) return;
            if (
                _currentInstance !== instance ||
                instance.isDestroyed ||
                instance.hotReloadEnabled
            ) {
                return;
            }
            instance.hotReloadEnabled = true;
            log("热重载已启用");
        },
    };
    return instance;
}

/** @returns {AutoGamer.InstanceInfo | null} */
function _getInstanceInfo() {
    return _currentInstance;
}

/** 清理 require.cache 中 dataDir/scripts 下的文件 */
function _clearDataDirRequireCache() {
    const prefixs = [
        path.normalize(`${config.dataDir}/scripts`),
        path.normalize(`${config.dataDir}/scriptData`),
    ];
    for (const key of Object.keys(require.cache)) {
        if (prefixs.some(prefix => path.normalize(key).startsWith(prefix))) {
            delete require.cache[key];
        }
    }
}

/** 请求一次热重载 */
function _requestReload() {
    if (_isReloading) return;
    if (_currentInstance && !_currentInstance.isDestroyed) {
        _currentInstance.isDestroyed = true;
    }
    _reloadResolve?.();
}

/**
 * 执行实例的清理函数
 * @param {AutoGamer.InstanceInfo} instance
 */
async function _runInstanceCleanup(instance) {
    for (const fn of instance.cleanupFunctions) {
        try {
            await fn();
        } catch (/** @type {any} */ e) {
            log("WARNING: 热重载清理函数执行出错:", e?.message ?? e);
        }
    }
    instance.cleanupFunctions = [];
}

/** 关闭浏览器后退出进程 @param {number} code */
async function _closeBrowserAndExit(code, exit = true) {
    _isExiting = true;
    try {
        log("尝试正常关闭浏览器");
        await _browser?.close();
    } catch (e) {
        log("浏览器似乎已经关闭，直接退出");
    }
    exit && process.exit(code);
}

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

process.on("uncaughtException", async err => {
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
    await _closeBrowserAndExit(1);
});

process.on("unhandledRejection", async (reason, promise) => {
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
    await _closeBrowserAndExit(1);
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
process.on("beforeExit", () => _closeBrowserAndExit(0, false));

process.on("SIGINT", async () => {
    _printExitWarnings();
    await _closeBrowserAndExit(0);
});
process.on("SIGTERM", async () => {
    _printExitWarnings();
    await _closeBrowserAndExit(1);
});

/**
 * 注入 inject.js 到页面
 * @param {import("puppeteer-core").Page} page
 * @param {(x: number, y: number) => any} tt
 * @param {(x: number, y: number, toX: number, toY: number, duration: number | undefined) => any} drag
 * @param {(x: number, y: number, duration: number | undefined) => any} hold
 */
async function inject(page, tt, drag, hold) {
    try {
        const injectPath = path.resolve(__dirname, "inject.js");
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
        while (fs.existsSync(injectPath)) {
            if (page.isClosed()) break;
            // 监听页面 postMessage 事件，自动模拟 tap/drag/hold
            try {
                await page.waitForNavigation({
                    timeout: 0,
                    waitUntil: "domcontentloaded",
                });
            } catch (e) {}
            await page.evaluate(alwaysHideOverlay => {
                // @ts-ignore
                window.__autoGamer = {
                    // @ts-ignore
                    simulateTouch: window.__autoGamerSimulateTouch,
                };

                window.addEventListener("message", ev => {
                    if (
                        ev &&
                        ev.data &&
                        (ev.data.type === "auto-gamer-mouse-to-tap" ||
                            ev.data.type === "auto-gamer-mouse-to-drag" ||
                            ev.data.type === "auto-gamer-mouse-to-hold" ||
                            ev.data.type === "auto-gamer-log")
                    ) {
                        // 通过 puppeteer 暴露的函数转发到 Node 端
                        // @ts-ignore
                        window.__autoGamer.simulateTouch(ev.data);
                    }
                });

                // 将全局配置注入页面，供 inject.js 读取
                // @ts-ignore
                window.__autoGamer.config = {
                    alwaysHideOverlay,
                };
            }, config.alwaysHideOverlay ?? false);
            page.evaluate(fs.readFileSync(injectPath, "utf-8")).catch(e => {});
            log("已注入 inject.js");
        }
    } catch (e) {}
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
Copyright (c) 2025~2026 dsy4567, GPL-3.0-or-later License
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
    const startTimeStr = formatLocalTimeWithTz();
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

    process.env.PUPPETEER_SKIP_DOWNLOAD = "true";
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
        ...(config.chromeExecPath
            ? { executablePath: config.chromeExecPath }
            : { channel: "chrome" }),
        userDataDir,
        args: config.puppeteerArgs,
    });
    _browser = browser;
    browser.on("disconnected", () => {
        if (_isExiting) return;
        log("所有浏览器窗口已关闭，程序退出");
        process.exit(0);
    });
    const page = await browser.newPage();
    const pages = await browser.pages();
    for (const p of pages) {
        if (p !== page) await p.close();
    }
    await page.bringToFront();
    await page.setUserAgent(config.mobileUA);
    log("已设置移动端UA");
    const pageOpenTime = Date.now();

    page.on("load", () => {
        log("网页完全加载", page.url());
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

    inject(page, tt, drag, hold);

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
            return await _closeBrowserAndExit(1);
        }

        const scriptPath = path.join(dataDir, "scripts", scriptId, "main.js");
        if (!fs.existsSync(scriptPath)) {
            log("ERROR: 找不到脚本:", scriptPath);
            return await _closeBrowserAndExit(1);
        }

        /**
         * 加载并执行脚本
         * @param {boolean} isHotReload
         */
        const _loadAndRunScript = async isHotReload => {
            _currentInstance = _createInstance(isHotReload);
            const instance = _currentInstance;

            log(isHotReload ? "热重载脚本:" : "加载操作脚本:", scriptPath);
            _clearDataDirRequireCache();
            /** @type {AutoGamer.ScriptFunction} */
            const script = require(scriptPath);
            if (typeof script !== "function") {
                log("ERROR: 脚本文件需导出一个 async function");
                await _closeBrowserAndExit(1);
                return;
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
                    getInstanceInfo: _getInstanceInfo,
                    enableHotReload: () => instance.enableHotReload(),
                });
            } catch (e) {
                log("ERROR: 脚本执行出错:", e);
            }
        };

        if (config.isDev) {
            // 开发模式：启用热重载循环
            _reloadPromise = new Promise(resolve => {
                _reloadResolve = resolve;
            });

            // 监听 main.js 变化，5 秒内限一次热重载
            fs.watch(scriptPath, eventType => {
                if (eventType !== "change") return;
                const now = Date.now();
                if (now - _lastReloadTime < 5000) {
                    // log("WARNING: 文件变化过于频繁，忽略此次热重载请求");
                    return;
                }
                _lastReloadTime = now;
                log("检测到脚本文件变化，触发热重载");
                _requestReload();
            });

            await _loadAndRunScript(false);

            while (true) {
                // 若实例已被标记销毁，说明热重载已被请求，跳过等待直接清理
                if (!_currentInstance || !_currentInstance.isDestroyed) {
                    log("等待脚本文件变化以触发热重载...");
                    await _reloadPromise;
                }

                if (_currentInstance && _currentInstance.isDestroyed) {
                    _isReloading = true;
                    await _runInstanceCleanup(_currentInstance);
                }

                _reloadPromise = new Promise(resolve => {
                    _reloadResolve = resolve;
                });

                _loadAndRunScript(true);
                _isReloading = false;
            }
        } else {
            _loadAndRunScript(false);
        }
    }
}

main();
