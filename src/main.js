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

const {
    log,
    logRaw,
    loggerHooks,
    setErrorLogFilePath,
    exitWarnings,
    onUncaughtException,
} = require("./logger.js");
const config = require("./config.default.js");
const { createUtils, formatLocalTimeWithTz } = require("./utils.js");
const loadUserConfig = require("./loadUserConfig.js");

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
    if (_isExiting) return;
    _isExiting = true;
    try {
        log("尝试正常关闭浏览器");
        await _browser?.close();
    } catch (e) {
        log("浏览器似乎已经关闭");
    }
    if (exit) {
        log("退出进程", code);
        process.exit(code);
    }
}

onUncaughtException.push(() => {
    _closeBrowserAndExit(1);
});
process.on("beforeExit", async () => await _closeBrowserAndExit(0, false));
process.on("SIGINT", async () => {
    await _closeBrowserAndExit(0);
});
process.on("SIGTERM", async () => {
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
        await page.evaluateOnNewDocument(() => {
            // 隐藏 navigator.webdriver，绕过最常见的 Puppeteer/自动化检测
            Object.defineProperty(navigator, "webdriver", { value: false });
        });

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

        await page.evaluateOnNewDocument(alwaysHideOverlay => {
            // @ts-ignore
            if (window.__autoGamer) return;
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

        let identifier = (
            await page.evaluateOnNewDocument(
                fs.readFileSync(injectPath, "utf-8"),
            )
        ).identifier;
        let lastInjectTime = 0;
        config.isDev &&
            fs.watch(injectPath, async () => {
                if (Date.now() - lastInjectTime < 300) return;
                lastInjectTime = Date.now();
                log("inject.js 已更新，重新注入");
                await page.removeScriptToEvaluateOnNewDocument(identifier);
                identifier = (
                    await page.evaluateOnNewDocument(
                        fs.readFileSync(injectPath, "utf-8"),
                    )
                ).identifier;
            });

        log("已注入 inject.js");
    } catch (e) {
        log("ERROR: 注入 inject.js 失败:", e);
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
 * 递归收集目录下所有文件的元数据
 * @param {string} baseDir 用于计算相对路径的基准目录
 * @param {string} dir 要扫描的目录
 * @param {Record<string, AutoGamer.FileMetadata>} result
 */
function _collectFileMetadata(baseDir, dir, result) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            _collectFileMetadata(baseDir, fullPath, result);
        } else if (stat.isFile()) {
            const relPath = path
                .relative(baseDir, fullPath)
                .split(path.sep)
                .join("/");
            result[relPath] = { size: stat.size, mtimeMs: stat.mtimeMs };
        }
    }
}

/**
 * 获取指定脚本相关的源文件元数据快照
 * @param {string} sourceDir 项目内 userData.default 源目录
 * @param {string|null} scriptId 当前脚本 id（null 表示所有脚本）
 * @returns {AutoGamer.SourceMetadata}
 */
function getSourceMetadata(sourceDir, scriptId) {
    /** @type {Record<string, AutoGamer.FileMetadata>} */
    const files = {};

    for (const file of ["README.md", "autoGamer.d.ts"]) {
        const filePath = path.join(sourceDir, file);
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            files[file] = { size: stat.size, mtimeMs: stat.mtimeMs };
        }
    }

    const shareDir = path.join(sourceDir, "share");
    _collectFileMetadata(sourceDir, shareDir, files);

    const scriptsDir = path.join(sourceDir, "scripts");
    if (scriptId) {
        const scriptDir = path.join(scriptsDir, scriptId);
        _collectFileMetadata(sourceDir, scriptDir, files);
    } else if (fs.existsSync(scriptsDir)) {
        for (const id of fs.readdirSync(scriptsDir)) {
            const scriptDir = path.join(scriptsDir, id);
            if (fs.statSync(scriptDir).isDirectory()) {
                _collectFileMetadata(sourceDir, scriptDir, files);
            }
        }
    }

    return { files };
}

/**
 * 读取已存储的源文件元数据
 * @param {string} dataDir 数据目录
 * @returns {AutoGamer.SourceMetadata | null}
 */
function _readStoredSourceMetadata(dataDir) {
    const metadataPath = path.join(dataDir, "sourceMetadata.json");
    if (!fs.existsSync(metadataPath)) return null;
    try {
        const content = fs.readFileSync(metadataPath, "utf-8");
        return JSON.parse(content);
    } catch (/** @type {any} */ e) {
        return null;
    }
}

/**
 * 写入源文件元数据快照
 * @param {string} dataDir 数据目录
 * @param {AutoGamer.SourceMetadata} metadata
 */
function writeSourceMetadata(dataDir, metadata) {
    const metadataPath = path.join(dataDir, "sourceMetadata.json");
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 4), "utf-8");
}

/**
 * 同步指定脚本相关的全部源文件到数据目录（用于元数据记录损坏时的全量同步）
 * @param {string} sourceDir 项目内 userData.default 源目录
 * @param {string} dataDir 数据目录
 * @param {string} scriptId 当前脚本 id
 */
function _syncScriptFiles(sourceDir, dataDir, scriptId) {
    const dirs = ["share", path.join("scripts", scriptId)];
    const files = ["README.md", "autoGamer.d.ts"];
    for (const item of [...dirs, ...files]) {
        const src = path.join(sourceDir, item);
        const dest = path.join(dataDir, item);
        if (!fs.existsSync(src)) continue;
        if (files.includes(item)) {
            copyForce(src, dest);
        } else {
            copyDirForce(src, dest);
        }
    }
}

/**
 * 启动时检查源文件元数据是否一致
 *
 * 行为由 config.autoSyncSourceFiles 控制（默认 true）：
 * - true：检测到不一致时自动把源文件同步到数据目录，并刷新元数据记录
 * - false：仅输出警告，提示用户手动执行 init <scriptId>
 *
 * @param {string} sourceDir 项目内 userData.default 源目录
 * @param {string} dataDir 数据目录
 * @param {string} scriptId 当前脚本 id
 * @returns {boolean}
 */
function checkSourceMetadata(sourceDir, dataDir, scriptId) {
    const current = getSourceMetadata(sourceDir, scriptId);
    const stored = _readStoredSourceMetadata(dataDir);
    // 归一化配置：接受 true/1/"1"/"true" 等可转换值，避免 === 严格比较失败（见避坑指南 #3）
    const autoSync = Boolean(config.autoSyncSourceFiles);

    if (!stored || typeof stored.files !== "object") {
        if (autoSync) {
            log(
                "WARNING: 源文件元数据记录不存在或已损坏，已自动同步源文件并重新生成记录",
            );
            _syncScriptFiles(sourceDir, dataDir, scriptId);
        } else {
            log(
                `WARNING: 源文件元数据记录不存在或已损坏，正在重新生成；如需同步文件请执行 init ${scriptId}`,
            );
        }
        writeSourceMetadata(dataDir, current);
        return true;
    }

    // 仅检查当前脚本相关文件：stored 可以是超集（例如 init 未指定脚本 id 时记录了全量文件）
    const currentKeys = Object.keys(current.files).sort();

    if (autoSync) {
        // 自动同步模式：收集所有不一致文件并复制，最后统一刷新元数据
        /** @type {string[]} */
        const changedKeys = [];
        for (const key of currentKeys) {
            const cur = current.files[key];
            const sto = stored.files[key];
            if (!sto || cur.size !== sto.size || cur.mtimeMs !== sto.mtimeMs) {
                changedKeys.push(key);
            }
        }
        if (changedKeys.length > 0) {
            for (const key of changedKeys) {
                log(`WARNING: 源文件 ${key} 需要更新，已自动同步最新文件`);
                const src = path.join(sourceDir, key);
                const dest = path.join(dataDir, key);
                if (fs.existsSync(src)) {
                    fs.mkdirSync(path.dirname(dest), { recursive: true });
                    copyForce(src, dest);
                }
            }
            writeSourceMetadata(dataDir, current);
        }
        return true;
    }

    // 仅警告模式：检测到首个不一致即返回，提示用户手动执行 init
    for (const key of currentKeys) {
        const cur = current.files[key];
        const sto = stored.files[key];
        if (!sto || cur.size !== sto.size || cur.mtimeMs !== sto.mtimeMs) {
            log(
                `WARNING: 源文件 ${key} 需要更新，建议执行 init ${scriptId} 以同步最新文件`,
            );
            return false;
        }
    }

    return true;
}

/**
 * 执行 init 命令：创建数据目录、各脚本的 logs/scriptData 子目录，并强制覆盖相关文件
 * @param {string} sourceDir 项目内 userData.default 源目录
 * @param {string} dataDir 数据目录
 * @param {string|null} [scriptId] 指定脚本 id（null 表示所有脚本）
 */
function runInit(sourceDir, dataDir, scriptId = null) {
    fs.mkdirSync(dataDir, { recursive: true });

    // 扫描源 scripts 目录，为相关脚本创建 logs/<id>/、scriptData/<id>/
    const scriptsSrc = path.join(sourceDir, "scripts");
    /** @type {string[]} */
    const ids = [];
    if (scriptId) {
        const scriptDir = path.join(scriptsSrc, scriptId);
        if (fs.existsSync(scriptDir) && fs.statSync(scriptDir).isDirectory()) {
            ids.push(scriptId);
        } else {
            log(`WARNING: 找不到脚本 ${scriptId}，跳过该脚本相关目录创建`);
        }
    } else if (fs.existsSync(scriptsSrc)) {
        ids.push(
            ...fs
                .readdirSync(scriptsSrc)
                .filter(id =>
                    fs.statSync(path.join(scriptsSrc, id)).isDirectory(),
                ),
        );
    }
    for (const id of ids) {
        ["logs", "scriptData"].forEach(dir => {
            fs.mkdirSync(path.join(dataDir, dir, id), {
                recursive: true,
            });
        });
    }

    // 强制覆盖（源=目标时跳过，避免递归）
    if (path.resolve(sourceDir) !== path.resolve(dataDir)) {
        const dirs = scriptId
            ? ["share", path.join("scripts", scriptId)]
            : ["share", "scripts"];
        const files = ["README.md", "autoGamer.d.ts"];
        const items = [...files, ...dirs];
        for (const item of items) {
            const src = path.join(sourceDir, item);
            const dest = path.join(dataDir, item);
            if (!fs.existsSync(src)) continue;
            if (files.includes(item)) {
                copyForce(src, dest);
            } else {
                copyDirForce(src, dest);
            }
        }

        // 非开发模式记录源文件元数据快照
        if (config.isDev !== 1) {
            const metadata = getSourceMetadata(sourceDir, scriptId);
            writeSourceMetadata(dataDir, metadata);
        }

        log("初始化完成:", dataDir, scriptId || "");
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
    const files = ["README.md", "autoGamer.d.ts"];
    const items = [...dirs, ...files];

    let initialized = false;
    if (items.some(item => !fs.existsSync(path.join(dataDir, item)))) {
        log("WARNING: 相关目录不存在，正在初始化");
        fs.mkdirSync(dataDir, { recursive: true });
        for (const item of items) {
            const src = path.join(sourceDir, item);
            const dest = path.join(dataDir, item);
            if (!fs.existsSync(src)) continue;
            if (files.includes(item)) {
                copyForce(src, dest);
            } else {
                copyDirForce(src, dest);
            }
        }
        initialized = true;
        log("已初始化数据目录:", dataDir);
    }

    // 为当前脚本创建 logs/<id>/、scriptData/<id>/
    if (scriptId) {
        ["logs", "scriptData"].forEach(dir => {
            fs.mkdirSync(path.join(dataDir, dir, scriptId), {
                recursive: true,
            });
        });
    }

    // 首次自动初始化时记录源文件元数据快照
    if (initialized && scriptId) {
        const metadata = getSourceMetadata(sourceDir, scriptId);
        writeSourceMetadata(dataDir, metadata);
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
  init [脚本id]         初始化数据目录（开发模式为 userData.default/，否则为 ~/.autoGamer/）；指定脚本 id 时仅同步该脚本相关文件
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
    const sourceDir = path.resolve(__dirname, "../userData.default");
    const dataDir = config.dataDir;

    // init 命令：初始化数据目录后退出
    if (isInit) {
        const initScriptId = positionals[1] ?? null;
        runInit(sourceDir, dataDir, initScriptId);
        process.exit(0);
    }

    // 非开发模式（贡献者）自动初始化：首次运行时创建数据目录并复制内置文件
    if (config.isDev !== 1) {
        ensureDataDir(sourceDir, dataDir, scriptId);
    }

    // 非开发模式且运行脚本时：检查源文件元数据是否仍与 init 时一致
    if (config.isDev !== 1 && !isLogin && scriptId) {
        checkSourceMetadata(sourceDir, dataDir, scriptId);
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
        setErrorLogFilePath(logFilePath);
        loggerHooks._logWriteFile = (now, str) => {
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
                exitWarnings.push(
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
    puppeteer = require("puppeteer-core");
    // if (!config.useStealth) {
    //     puppeteer = require("puppeteer-core");
    // } else {
    //     // @ts-ignore
    //     puppeteer = require("puppeteer-extra");
    //     const StealthPlugin = require("puppeteer-extra-plugin-stealth");
    //     // @ts-ignore
    //     puppeteer.use(StealthPlugin());
    // }

    const userDataDir =
        config.dirs?.chromeDataDir ?? path.join(config.dataDir, "chromeData");

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: config.viewport,
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

    loggerHooks._logWriteHtml = async content => {
        try {
            await page.evaluate(content => {
                window.postMessage({
                    type: "auto-gamer-log",
                    content,
                });
            }, content);
        } catch (e) {}
    };

    await inject(page, tt, drag, hold);

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

            try {
                /** @type {AutoGamer.ScriptFunction} */
                const script = require(scriptPath);
                if (typeof script !== "function") {
                    log("ERROR: 脚本文件需导出一个 async function");
                    !isHotReload && (await _closeBrowserAndExit(1));
                    return;
                }
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
