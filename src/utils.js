/**
 * @fileoverview 提供一些实用工具函数
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check
"use strict";

const readline = require("readline");
const path = require("path");
const fs = require("fs");
const { PNG } = require("pngjs");
const config = require("./config.default.js");

// 放在模块作用域，确保 createUtils 多次调用也只存在一个定时截图 timer
/**
 * @type {string | number | NodeJS.Timeout | null | undefined}
 */
let _autoScreenshotTimer = null;
// 放在模块作用域，确保 createUtils 多次调用时节流和防并发状态全局共享
let _lastScreenshotTime = 0;
let _screenshotInProgress = false;
// 放在模块作用域，确保开发模式截图警告只输出一次
let _devScreenshotWarned = false;

// 放在模块作用域，确保 createUtils 多次调用时任务超时定时器全局共享
/**
 * @type {NodeJS.Timeout | null}
 */
let _taskTimer = null;

// 按实例维护 action 状态，开发模式热重载时各实例互不污染
/** @type {Map<string, AutoGamer.ActionState>} */
const _actionStateMap = new Map();

// 文件缓存，避免重复读取同一文件
/** @type {Map<string, { buffer: Buffer }>} */
let _fileBufferCache = new Map();

/**
 * 读取文件并缓存，如果文件已缓存则返回缓存内容
 * @param {string} filePath 文件绝对路径
 * @returns {Buffer}
 */
function _getFileBuffer(filePath) {
    const cached = _fileBufferCache.get(filePath);
    if (cached) {
        return cached.buffer;
    }
    const buffer = fs.readFileSync(filePath);
    _fileBufferCache.set(filePath, { buffer });
    return buffer;
}

/** 当前活跃的 REPL 会话，开发模式下复用 @type {import("readline").Interface | null} */
let _activeRl = null;
/** 当前 REPL 使用的 eval 函数，热重载时更新 @type {AutoGamer.EvalFn} */
let _replEval = eval;

/** 热重载前最后一次 action @type {string | null} */
let lastAction = null;

/**
 * 创建默认的 action 状态
 * @returns {AutoGamer.ActionState}
 */
function _createDefaultActionState() {
    return {
        startAtChain: null,
        startAtIndex: 0,
        startAtReached: false,
        endAtChain: null,
        endAtIndex: 0,
        endAtReached: false,
        endAtPassed: false,
        stateInitialized: false,
        dbgEnabled: false,
        dbgQueue: [],
        waitSceneChangeInProgress: false,
    };
}

/**
 * 将 Date 格式化为本地时间字符串（带时区偏移），文件系统安全
 * 格式示例（Asia/Shanghai）: 2026-07-06_20-34-56-789+08-00
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
function formatLocalTimeWithTz(date = new Date()) {
    const d = date;
    const pad = (/** @type {number} */ n, /** @type {number} */ len = 2) =>
        String(n).padStart(len, "0");
    const offset = -d.getTimezoneOffset(); // 东半球为正
    const sign = offset >= 0 ? "+" : "-";
    const absOffset = Math.abs(offset);
    const tz = `${sign}${pad(Math.floor(absOffset / 60))}-${pad(absOffset % 60)}`;
    return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}` +
        tz
    );
}

/**
 * 使用 Block MSE 算法计算两张 PNG 图片的相似度
 *
 * 注意：两张 PNG 图片的尺寸必须完全相同，否则会抛出异常
 *
 * @param {Buffer} buf1
 * @param {Buffer} buf2
 * @param {number} [blockSize=16]
 * @returns {number} 相似度 [0, 1]
 * @throws {Error} 当两张图片尺寸不一致时抛出
 */
function calculateSimilarity(buf1, buf2, blockSize = 16) {
    const b1 = Buffer.isBuffer(buf1) ? buf1 : Buffer.from(buf1);
    const b2 = Buffer.isBuffer(buf2) ? buf2 : Buffer.from(buf2);
    const png1 = PNG.sync.read(b1);
    const png2 = PNG.sync.read(b2);

    if (png1.width !== png2.width || png1.height !== png2.height) {
        throw new Error(
            `图片尺寸不一致: ${png1.width}x${png1.height} vs ${png2.width}x${png2.height}`,
        );
    }

    const width = png1.width;
    const height = png1.height;

    const blocksX = Math.ceil(width / blockSize);
    const blocksY = Math.ceil(height / blockSize);

    let totalMse = 0;
    let blockCount = 0;

    for (let by = 0; by < blocksY; by++) {
        for (let bx = 0; bx < blocksX; bx++) {
            let blockMse = 0;
            let pixelCount = 0;

            const yStart = by * blockSize;
            const yEnd = Math.min(yStart + blockSize, height);
            const xStart = bx * blockSize;
            const xEnd = Math.min(xStart + blockSize, width);

            for (let y = yStart; y < yEnd; y++) {
                for (let x = xStart; x < xEnd; x++) {
                    const idx1 = (y * png1.width + x) << 2;
                    const idx2 = (y * png2.width + x) << 2;

                    const dr = png1.data[idx1] - png2.data[idx2];
                    const dg = png1.data[idx1 + 1] - png2.data[idx2 + 1];
                    const db = png1.data[idx1 + 2] - png2.data[idx2 + 2];

                    blockMse += (dr * dr + dg * dg + db * db) / 3;
                    pixelCount++;
                }
            }

            if (pixelCount > 0) {
                totalMse += blockMse / pixelCount;
                blockCount++;
            }
        }
    }

    const avgMse = blockCount > 0 ? totalMse / blockCount : 0;
    const maxMse = 255 * 255;
    return Math.max(0, Math.min(1, 1 - avgMse / maxMse));
}

/**
 * @param {AutoGamer.UtilsCtx | AutoGamer.ScriptCtx} ctx
 * @param {AutoGamer.EvalFn} [_eval=eval] 用于 REPL 中执行代码的 eval 函数
 */
function createUtils(ctx, _eval = eval) {
    const { puppeteer, browser, page, log, logRaw, pageOpenTime, logDir } = ctx;
    const info = ctx.getInstanceInfo?.();
    const instanceId = info?.instanceId ?? "default";

    ctx.getInstanceInfo?.()?.cleanupFunctions.push(() => {
        _fileBufferCache = new Map();
    });

    /**
     * 检查当前实例是否已销毁，销毁时清理该实例的 action 状态
     * @returns {boolean}
     */
    const isInstanceDestroyed = () => {
        if (info?.isDestroyed) {
            // _actionStateMap.delete(instanceId);
            return true;
        }
        return false;
    };

    // 按实例初始化 action 状态
    if (!_actionStateMap.has(instanceId)) {
        _actionStateMap.set(instanceId, _createDefaultActionState());
    }
    const state = /** @type {AutoGamer.ActionState} */ (
        _actionStateMap.get(instanceId)
    );

    // 从 ctx 初始化 --start-at / --end-at 描述链（仅初始化一次，后续 action("startAt"/"endAt") 可覆盖）
    if (!state.stateInitialized) {
        state.stateInitialized = true;
        state.startAtChain = ctx.startAtChain ?? null;
        state.endAtChain = ctx.endAtChain ?? null;
    }

    /**
     * 触摸开始 - 在指定坐标触发 touchStart 事件；如无特别需求，推荐使用 {@link tt} (touch tap) {@link hold} {@link drag}
     * @param {number} x 横坐标
     * @param {number} y 纵坐标
     */
    const ts = (x, y) => {
        page.evaluate(`window.__autoGamer.updateCrosshair(${x}, ${y})`);
        return page.touchscreen.touchStart(x, y);
    };
    /** 触摸结束 - 触发 touchEnd 事件；如无特别需求，推荐使用 {@link tt} (touch tap) {@link hold} {@link drag} */
    const te = () => page.touchscreen.touchEnd();
    /**
     * 触摸移动 - 在指定坐标触发 touchMove 事件；如无特别需求，推荐使用 {@link tt} (touch tap) {@link hold} {@link drag}
     * @param {number} x 横坐标
     * @param {number} y 纵坐标
     */
    const tm = (x, y) => {
        page.evaluate(`window.__autoGamer.updateCrosshair(${x}, ${y})`);
        return page.touchscreen.touchMove(x, y);
    };
    /**
     * 触摸点击 - 在指定坐标触发 tap 事件
     * @param {number} x 横坐标
     * @param {number} y 纵坐标
     */
    const tt = (x, y) => {
        page.evaluate(`window.__autoGamer.updateCrosshair(${x}, ${y})`);
        return page.touchscreen.tap(x, y);
    };
    /**
     * 页面点击 - 调用 page.click(selector)
     * @param {string} selector 传递给 page.click 的参数
     */
    const pc = selector => page.click(selector);
    /**
     * 长按 - 在指定坐标按下并保持一段时间后释放
     * @param {number} x 横坐标
     * @param {number} y 纵坐标
     * @param {number} [hold=1000] 按住时长（毫秒）
     */
    const hold = async (x, y, hold = 1000) => {
        await ts(x, y);
        await sleep(hold);
        await te();
    };
    /**
     * 拖拽 - 从起点拖拽到终点，分步模拟触摸移动
     * @param {number} fromX 起点横坐标
     * @param {number} fromY 起点纵坐标
     * @param {number} toX 终点横坐标
     * @param {number} toY 终点纵坐标
     * @param {number} [duration=500] 拖拽持续时间（毫秒）
     */
    const drag = async (
        fromX,
        fromY,
        toX,
        toY,
        duration = config.automation?.defaultDragDuration ?? 500,
    ) => {
        const steps = duration / 22; // 45 fps
        const stepDuration = duration / steps;
        const stepX = (toX - fromX) / steps;
        const stepY = (toY - fromY) / steps;

        await ts(fromX, fromY);
        for (let i = 1; i <= steps; i++) {
            await sleep(stepDuration);
            await tm(fromX + stepX * i, fromY + stepY * i);
        }
        await te();
    };
    /**
     * 延时等待
     * @param {number} ms 等待毫秒数
     * @returns {Promise<void>}
     */
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    // TODO: 执行自定义函数
    /**
     * 请求人工干预 - 在页面显示提示，等待用户触摸后按 Alt+M 继续，或超时自动继续
     *
     * 通过 page.evaluate 调用页面端 window.__autoGamer.requestManualIntervention
     * 并 await 其返回的 Promise。如果页面端调用失败，会打印 WARNING 并静默返回，
     * 避免脚本因页面未注入或执行异常而中断。
     *
     * @param {string} [msg=""] 干预说明
     * @param {number} [timeout=15000] 超时毫秒
     * @returns {Promise<boolean>} 用户按 Alt+M 手动结束时返回 true，超时返回 false；调用失败时返回 false
     */
    const mi = async (msg = "", timeout = 15000) => {
        try {
            log(
                "请求人工干预，超时毫秒:",
                timeout,
                "\n==========",
                msg,
                "==========",
            );
            const result = await page.evaluate(
                (m, t) => {
                    return window.__autoGamer?.requestManualIntervention?.(
                        m,
                        t,
                    );
                },
                msg,
                timeout,
            );
            return Boolean(result);
        } catch (e) {
            log("WARNING: 人工干预调用失败", /** @type {any} */ (e).message);
            return false;
        }
    };

    /**
     * 设置关闭网页前是否弹出二次确认提示（window.onbeforeunload）
     * @param {boolean} [enabled=true] 为 true 时启用二次确认，为 false 时取消
     * @returns {Promise<void>}
     */
    const setBeforeUnload = async (enabled = true) => {
        await page.evaluate(
            /** @param {boolean} enabled */
            enabled => {
                window.onbeforeunload = enabled ? () => false : null;
            },
            enabled,
        );
        log(`${enabled ? "已启用" : "已禁用"}关闭网页前二次确认`);
    };

    /**
     * 统一的自动化操作函数，自动处理流程控制、日志、截图
     * @overload
     * @param {string} description
     * @param {AutoGamer.OperationArray} [operations]
     * @param {AutoGamer.ActionOptions} [options]
     * @returns {Promise<void>}
     * @overload
     * @param {"toggleDbg" | "next" | "skip"} description
     * @returns {Promise<void>}
     * @overload
     * @param {"startAt" | "endAt"} description
     * @param {string | string[]} operations
     * @returns {Promise<void>}
     * @overload
     * @param {"waitSceneChange"} description
     * @param {AutoGamer.OperationArray} operations
     * @param {AutoGamer.WaitSceneChangeOptions} [options]
     * @returns {Promise<void>}
     * @param {string} description
     * @param {string | string[]} [operations]
     * @param {AutoGamer.ActionOptions | AutoGamer.WaitSceneChangeOptions | {}} [options]
     * @returns {Promise<void>}
     */
    const action = async (description, operations, options) => {
        if (isInstanceDestroyed()) return;

        // 特殊指令：覆盖 start-at
        if (description === "startAt") {
            const chain =
                typeof operations === "string"
                    ? operations.split("#")
                    : Array.isArray(operations)
                      ? operations
                      : null;
            // 空chain时重置状态
            if (
                !chain ||
                chain.length === 0 ||
                (chain.length === 1 && chain[0] === "")
            ) {
                state.startAtChain = null;
                state.startAtIndex = 0;
                state.startAtReached = false;
                log("action startAt 已重置");
                return;
            }
            state.startAtChain = chain;
            state.startAtIndex = 0;
            state.startAtReached = false;
            log(`action startAt 已覆盖: ${chain.join("#")}`);
            return;
        }

        // 特殊指令：覆盖 end-at
        if (description === "endAt") {
            const chain =
                typeof operations === "string"
                    ? operations.split("#")
                    : Array.isArray(operations)
                      ? operations
                      : null;
            // 空chain时重置状态
            if (
                !chain ||
                chain.length === 0 ||
                (chain.length === 1 && chain[0] === "")
            ) {
                state.endAtChain = null;
                state.endAtIndex = 0;
                state.endAtReached = false;
                state.endAtPassed = false;
                log("action endAt 已重置");
                return;
            }
            state.endAtChain = chain;
            state.endAtIndex = 0;
            state.endAtReached = false;
            state.endAtPassed = false;
            log(`action endAt 已覆盖: ${chain.join("#")}`);
            return;
        }

        // 特殊指令：切换调试模式
        if (description === "toggleDbg") {
            state.dbgEnabled = !state.dbgEnabled;
            log(`action 调试模式: ${state.dbgEnabled ? "开启" : "关闭"}`);
            if (!state.dbgEnabled && state.dbgQueue.length > 0) {
                log(
                    `action 调试模式关闭，自动兑现 ${state.dbgQueue.length} 个挂起任务`,
                );
                const queue = state.dbgQueue.splice(0, state.dbgQueue.length);
                for (const {
                    resolve,
                    reject,
                    task,
                    description: taskDesc,
                } of queue) {
                    log(`action 调试兑现: ${taskDesc}`);
                    try {
                        await task();
                        resolve();
                    } catch (/** @type {any} */ e) {
                        reject(e);
                    }
                }
            }
            return;
        }

        // 特殊指令：调试模式下执行下一个挂起的 action
        if (description === "next") {
            const nextAction = state.dbgQueue.shift();
            if (!nextAction) {
                log("WARNING: action next 无挂起的调试任务");
                return;
            }
            const { resolve, reject, task, description: taskDesc } = nextAction;
            log(`action next 执行: ${taskDesc}`);
            try {
                await task();
                resolve();
            } catch (e) {
                reject(e);
            }
            return;
        }

        // 特殊指令：调试模式下跳过下一个挂起的 action（直接 resolve，不执行操作）
        if (description === "skip") {
            const skipAction = state.dbgQueue.shift();
            if (!skipAction) {
                log("WARNING: action skip 无挂起的调试任务");
                return;
            }
            const { resolve, description: taskDesc } = skipAction;
            log(`action skip 跳过: ${taskDesc}`);
            resolve();
            return;
        }

        if (['"', "'", "\\", "#"].some(char => description?.includes(char))) {
            log(
                "WARNING: action 简要描述包含 #\"'\\ 字符，可能引发一系列问题，例如影响 --start-at / --end-at 的匹配结果",
            );
        }

        // --start-at：未到达锚点前跳过
        if (state.startAtChain && !state.startAtReached) {
            if (description === state.startAtChain[state.startAtIndex]) {
                state.startAtIndex++;
                if (state.startAtIndex === state.startAtChain.length) {
                    state.startAtReached = true;
                }
            }
            if (!state.startAtReached) {
                return;
            }
        }

        // --end-at：已越过锚点后跳过
        if (state.endAtPassed) {
            return;
        }

        // --end-at：推进匹配进度，若当前 action 恰好是锚点，执行完后标记越过
        let shouldPassAfterThis = false;
        if (state.endAtChain && !state.endAtReached) {
            if (description === state.endAtChain[state.endAtIndex]) {
                state.endAtIndex++;
                if (state.endAtIndex === state.endAtChain.length) {
                    state.endAtReached = true;
                    shouldPassAfterThis = true;
                }
            }
        }

        /** action 核心执行逻辑 */
        const _runActionCore = async () => {
            log("ACTION:", description);
            lastAction = description;

            const doOpsArray = async (
                /** @type {AutoGamer.OperationArray | string[] | string | undefined} */ ops,
                /** @type {() => boolean} */ shouldPauseCheck = () => false,
            ) => {
                if (!ops || !Array.isArray(ops)) return;
                for (const op of ops || []) {
                    // 检查是否需要暂停，如需要则立即退出循环
                    if (shouldPauseCheck()) break;
                    if (isInstanceDestroyed()) break;

                    if (!Array.isArray(op)) continue;
                    if (op[0] === "fn") {
                        // 自定义函数操作：["fn", (desc, ctx, ...args) => any, [...args]]
                        // 通过 await 执行，不处理抛错
                        const userFn = op[1];
                        const userArgs = op[2] || [];
                        await userFn(description, ctx, ...userArgs);
                        continue;
                    }
                    if (op[0] === "cs") {
                        // 截图比对操作：["cs", pngPath, options?, onMatch?, onError?]
                        // 匹配成功执行 onMatch，比对出错执行 onError，匹配失败仅警告
                        const [, pngPath, cmpOpts, onMatch, onError] = op;
                        /** @type {AutoGamer.CompareScreenshotOptions} */
                        const csOpts =
                            typeof cmpOpts === "object" && cmpOpts !== null
                                ? cmpOpts
                                : {};
                        csOpts.threshold = csOpts.threshold || 0.5;
                        let matched = false;
                        try {
                            matched = await compareScreenshot(
                                /** @type {string} */ (pngPath),
                                csOpts,
                            );
                        } catch (e) {
                            log(
                                "WARNING: 截图比对出错，将执行兜底操作:",
                                /** @type {any} */ (e).message || e,
                            );
                            await doOpsArray(
                                /** @type {AutoGamer.OperationArray | undefined} */ (
                                    onError
                                ),
                                shouldPauseCheck,
                            );
                            continue;
                        }
                        if (matched) {
                            await doOpsArray(
                                /** @type {AutoGamer.OperationArray | undefined} */ (
                                    onMatch
                                ),
                                shouldPauseCheck,
                            );
                        } else {
                            log("截图比对未通过，已跳过操作");
                        }
                        continue;
                    }
                    const [fnName, ...args] = op;
                    const fn =
                        /** @type {Record<string, (...args: any[]) => any>} */ ({
                            ts,
                            te,
                            tm,
                            tt,
                            pc,
                            hold,
                            sleep,
                            drag,
                            mi,
                            setBeforeUnload,
                        })[fnName];
                    if (!fn) {
                        log(`WARNING: 存在未知操作 "${fnName}"，已跳过`);
                        continue;
                    }
                    await fn(...args);
                }
            };

            // 特殊操作：等待场景大幅变化，里面有 return 语句
            if (description === "waitSceneChange") {
                if (state.waitSceneChangeInProgress) {
                    throw new Error("waitSceneChange 已有实例正在执行中");
                }
                state.waitSceneChangeInProgress = true;

                try {
                    // 处理边界情况
                    /** @type {AutoGamer.WaitSceneChangeOptions} */
                    const wscOpts =
                        typeof options === "object" && options !== null
                            ? options
                            : {};
                    const timeout = Math.max(
                        0,
                        Number(wscOpts.timeout) || 600000,
                    );
                    const recheckCount = Math.max(
                        0,
                        Math.floor(Number(wscOpts.recheckCount) || 0),
                    );
                    const normalInterval = Math.max(
                        200,
                        Number(wscOpts.interval) || 3000,
                    );
                    const recheckInterval = 3000; // 复查阶段固定使用3000ms
                    const threshold = Math.min(
                        1,
                        Math.max(0, Number(wscOpts.threshold) || 0.9),
                    );
                    const inverse = Boolean(wscOpts.inverse);
                    const referenceFile = wscOpts.referenceFile
                        ? path.resolve(String(wscOpts.referenceFile))
                        : null;

                    // 检测 operations 是否包含 sleep 操作
                    const hasSleep =
                        Array.isArray(operations) &&
                        operations.some(
                            /** @type {(op: any) => boolean} */ op =>
                                Array.isArray(op) && op[0] === "sleep",
                        );
                    if (
                        !hasSleep &&
                        Array.isArray(operations) &&
                        operations.length > 0
                    ) {
                        log(
                            "WARNING: waitSceneChange 的 operations 数组未包含 sleep 操作，可能导致高频循环，已跳过 operations 执行",
                        );
                    }

                    // clip 校验：提供时必须包含完整属性
                    /** @type {{x: number, y: number, width: number, height: number} | undefined} */
                    let clip;
                    if (wscOpts.clip !== undefined && wscOpts.clip !== null) {
                        const c = wscOpts.clip;
                        if (
                            typeof c !== "object" ||
                            c.x === undefined ||
                            c.y === undefined ||
                            c.width === undefined ||
                            c.height === undefined
                        ) {
                            throw new Error(
                                "waitSceneChange 的 clip 属性不完整，需包含 x, y, width, height",
                            );
                        }
                        clip = {
                            x: Number(c.x),
                            y: Number(c.y),
                            width: Number(c.width),
                            height: Number(c.height),
                        };
                    }

                    if (timeout <= 0) {
                        if (shouldPassAfterThis) state.endAtPassed = true;
                        return;
                    }

                    const startTime = Date.now();

                    /**
                     * 截图（应用 clip 裁剪区域）
                     * @param {string} label 截图标签
                     * @returns {Promise<Buffer>}
                     */
                    const takeScreenshot = async label => {
                        return await screenshot(label, {
                            returnBuffer: true,
                            ...(clip ? { clip } : {}),
                        });
                    };

                    /** @type {Buffer | null} */
                    let prevBuffer = null;

                    if (referenceFile) {
                        prevBuffer = _getFileBuffer(referenceFile);
                        log(
                            "waitSceneChange 使用指定文件作为基准图:",
                            referenceFile,
                        );
                    } else {
                        // 首次截图
                        while (true) {
                            try {
                                prevBuffer =
                                    await takeScreenshot(
                                        "waitSceneChange-基准",
                                    );
                                break;
                            } catch (e) {
                                if (Date.now() - startTime >= timeout) {
                                    throw new Error("等待场景变化超时");
                                }
                                log(
                                    "WARNING: waitSceneChange 首次截图失败，3秒后重试:",
                                    /** @type {any} */ (e).message || e,
                                );
                                await sleep(3000);
                            }
                        }
                    }

                    let recheckPassed = 0; // 已通过的复查次数
                    let inRecheckPhase = false; // 是否进入复查阶段

                    // 并行执行模式：使用共享状态变量协调并行流程
                    let pauseOpsLoop = false; // 是否暂停 operations 循环
                    let shouldStop = false; // 是否停止所有流程

                    // 流程A：截图比对流程
                    const sceneChangeDetector = (async () => {
                        log("waitSceneChange 开始二次截图比对流程");
                        while (Date.now() - startTime < timeout) {
                            if (isInstanceDestroyed()) {
                                shouldStop = true;
                                return;
                            }
                            const elapsed = Date.now() - startTime;

                            // 等待下一个截图时间点
                            const currentInterval = inRecheckPhase
                                ? recheckInterval
                                : normalInterval;
                            const waitTime = Math.min(
                                currentInterval,
                                timeout - elapsed,
                            );
                            await sleep(waitTime);

                            if (Date.now() - startTime >= timeout) {
                                shouldStop = true;
                                throw new Error("等待场景变化超时");
                            }

                            let currentBuffer;
                            try {
                                currentBuffer =
                                    await takeScreenshot(
                                        "waitSceneChange-比对",
                                    );
                            } catch (e) {
                                if (Date.now() - startTime >= timeout) {
                                    shouldStop = true;
                                    throw new Error("等待场景变化超时");
                                }
                                log(
                                    "WARNING: waitSceneChange 截图失败，3秒后重试:",
                                    /** @type {any} */ (e).message,
                                );
                                await sleep(3000);
                                continue;
                            }

                            const similarity = calculateSimilarity(
                                /** @type {Buffer} */ (prevBuffer),
                                currentBuffer,
                            );
                            log(`场景相似度: ${similarity.toFixed(4)}`);

                            const conditionMet = inverse
                                ? similarity >= threshold
                                : similarity < threshold;

                            if (conditionMet) {
                                if (recheckCount >= 1) {
                                    if (!inRecheckPhase) {
                                        inRecheckPhase = true;
                                        pauseOpsLoop = true; // 暂停 operations 循环
                                        log(
                                            "条件首次满足，进入复查阶段（暂停 operations 循环）",
                                        );
                                    }
                                    recheckPassed++;
                                    log(
                                        `条件满足，复查进度: ${recheckPassed}/${recheckCount}`,
                                    );
                                    if (recheckPassed >= recheckCount) {
                                        shouldStop = true; // 停止所有流程
                                        log(
                                            inverse
                                                ? "场景未发生变化（已复查确认），继续执行"
                                                : "场景已发生大幅变化（已复查确认），继续执行",
                                        );
                                        if (shouldPassAfterThis)
                                            state.endAtPassed = true;
                                        return;
                                    }
                                    // 继续下一次循环进行复查
                                } else {
                                    shouldStop = true; // 停止所有流程
                                    log(
                                        inverse
                                            ? "场景未发生变化，继续执行"
                                            : "场景已发生大幅变化，继续执行",
                                    );
                                    if (shouldPassAfterThis)
                                        state.endAtPassed = true;
                                    return;
                                }
                            } else {
                                // 条件不满足，重置复查计数和复查阶段
                                if (recheckPassed > 0) {
                                    pauseOpsLoop = false; // 恢复 operations 循环
                                    log(
                                        `条件不再满足，复查计数已重置 (${recheckPassed} → 0)，退出复查阶段`,
                                    );
                                    recheckPassed = 0;
                                    inRecheckPhase = false;
                                }
                            }

                            prevBuffer = currentBuffer;
                        }

                        // 超时
                        shouldStop = true;
                        throw new Error("等待场景变化超时");
                    })().finally(() => {
                        // 兜底：任何退出路径（包括 calculateSimilarity 抛错等未预期异常）
                        // 都确保 opsLoop 收到停止信号，避免孤儿 Promise 继续执行操作
                        shouldStop = true;
                    });

                    // 流程B：operations 循环流程（仅在有 sleep 且有 operations 时启动）
                    const opsLoop =
                        hasSleep &&
                        Array.isArray(operations) &&
                        operations.length > 0
                            ? (async () => {
                                  while (!shouldStop) {
                                      if (isInstanceDestroyed()) return;
                                      if (pauseOpsLoop) {
                                          await sleep(100); // 暂停期间短暂休眠避免空转
                                          continue;
                                      }
                                      try {
                                          log("waitSceneChange 执行一批操作");
                                          // NOTE: 不需要 race 检查 shouldStop || pauseOpsLoop 退出，
                                          // 脚本紧接着执行触摸等操作可能会乱套，等待执行完就行
                                          await doOpsArray(
                                              operations,
                                              () => shouldStop || pauseOpsLoop,
                                          );
                                      } catch (e) {
                                          log(
                                              "WARNING: waitSceneChange operations 执行错误:",
                                              /** @type {any} */ (e).message,
                                          );
                                      }
                                  }
                              })()
                            : Promise.resolve();

                    // 等待两个流程都结束
                    // 若 sceneChangeDetector 异常退出，Promise.all 会立即 reject，
                    // 此时 opsLoop 仍可能在运行。需等 opsLoop 也停止后再抛错，
                    // 否则 opsLoop 作为孤儿 Promise 会在上层人工干预期间继续执行操作
                    try {
                        await Promise.all([sceneChangeDetector, opsLoop]);
                    } catch (e) {
                        shouldStop = true; // 兜底确保 opsLoop 停止
                        await opsLoop.catch(() => {}); // 等待 opsLoop 真正退出
                        throw e;
                    }
                } finally {
                    state.waitSceneChangeInProgress = false;
                }
                // waitSceneChange 自行管理 operations 的执行（见 opsLoop），
                // 正常完成路径必须 return，否则会落到下方通用 doOpsArray(operations)
                // 导致 operations 被额外完整执行一次
                return;
            }

            await doOpsArray(operations);

            /** @type {AutoGamer.ActionOptions} */
            const aOpts =
                typeof options === "object" && options !== null ? options : {};
            // 自动截图（迁移自 index.js 的 _logScreenshot 逻辑）
            if (
                config.screenshots?.screenshotOnLog !== false &&
                aOpts?.screenshot !== false
            ) {
                screenshot(description).catch(() => {});
            }

            if (shouldPassAfterThis) {
                state.endAtPassed = true;
            }
        };

        if (state.dbgEnabled) {
            log(`action 调试挂起: ${description}`);
            return new Promise((resolve, reject) => {
                state.dbgQueue.push({
                    resolve,
                    reject,
                    task: _runActionCore,
                    description,
                });
            });
        }

        await _runActionCore();
    };

    /**
     * 启动实时测试 REPL，可在终端输入并执行 puppeteer 代码
     * 可用变量: browser, page, puppeteer, log 等
     * 输入 "exit" 退出 REPL 并关闭浏览器
     * @returns {Promise<void>}
     */
    const startRepl = async () => {
        await sleep(1000);

        // 更新当前 REPL 使用的 eval 函数、ctx，开发模式下热重载时复用同一个 REPL
        _replEval = _eval;
        // ctx = _;
        // 开发模式下热重载时复用同一个 REPL 会话，只更新 _replEval
        if (_activeRl) {
            log("REPL 已存在，复用当前会话");
            log(
                "上次执行的 action:",
                lastAction,
                "输入 la 以设置 startAt、执行 main()",
            );
            return;
        }

        log(
            "进入实时测试模式，可输入并执行 puppeteer 代码 (用 browser, page, puppeteer, log 等变量)",
        );
        log(
            "\n输入 exit 退出 REPL，使用 return 语句获取执行结果\n快捷命令: next / skip / tdbg\n输入 help 获取更多帮助\n确保网页获得焦点后可按住 alt+鼠标左键，发送 touch tap/drag/hold 事件",
        );

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: "> ",
        });
        _activeRl = rl;

        rl.prompt();
        rl.on("line", async input => {
            // 输入包含特殊文本则不应用优化，直接执行原始代码
            let enableEnhanced = true;
            if (
                [
                    ";",
                    "var",
                    "let",
                    "const",
                    "return",
                    "if",
                    "for",
                    "while",
                    "switch",
                    "do",
                    "try",
                    "function",
                    "class",
                ].some(kwd => input.includes(kwd))
            )
                enableEnhanced = false;

            if (enableEnhanced) {
                const trimmed = input.trim();
                if (trimmed === "exit") {
                    rl.close();
                    return;
                }
                if (trimmed === "") {
                    log("网页已打开毫秒数:", Date.now() - pageOpenTime);
                    return;
                }
                if (trimmed === "next") {
                    try {
                        await _replEval('action("next")');
                    } catch (e) {
                        log("WARNING: next 执行错误:", e);
                    }
                    rl.prompt();
                    return;
                }
                if (trimmed === "skip") {
                    try {
                        await _replEval('action("skip")');
                    } catch (e) {
                        log("WARNING: skip 执行错误:", e);
                    }
                    rl.prompt();
                    return;
                }
                if (trimmed === "tdbg") {
                    try {
                        await _replEval('action("toggleDbg")');
                    } catch (e) {
                        log("WARNING: tdbg 执行错误:", e);
                    }
                    rl.prompt();
                    return;
                }
                if (trimmed === "la") {
                    try {
                        await _replEval(
                            `(async ()=>{await action("startAt", "${lastAction}");return main()})()`,
                        );
                    } catch (e) {
                        log("WARNING: la 执行错误:", e);
                    }
                    rl.prompt();
                    return;
                }
                if (trimmed === "rc") {
                    try {
                        await _replEval(
                            `(async ()=>{await action("startAt", null);await action("endAt", null)})()`,
                        );
                    } catch (e) {
                        log("WARNING: rc 执行错误:", e);
                    }
                    rl.prompt();
                    return;
                }
                if (trimmed === "help") {
                    log(
                        `
注意：REPL 不支持使用 let 等关键字声明变量供后续使用

可用命令:
  exit          - 退出 REPL 并关闭浏览器
  next          - 调试模式下执行下一个挂起的 action
  skip          - 调试模式下跳过下一个挂起的 action
  tdbg          - 开启/关闭 action 调试模式
  la            - 仅适用于热重载后，重置 startAt 为最后一个 Action，并执行 main()
  rc            - 重置 startAt、endAt
  help          - 显示此帮助信息
  <空回车>       - 显示网页已打开毫秒数
  <JS 代码>      - 执行代码 (可用 browser, page, puppeteer, log 等变量)

action() 部分用法:
  action('startAt', '<描述1#描述2>') / action('startAt', ['<描述1>','<描述2>'])
   — 前面的描述链辅助定位，从最后一个描述开始执行 action，覆盖 --start-at 命令行参数
  action('endAt', '<描述1#描述2>') / action('endAt', ['<描述1>','<描述2>'])
   — 前面的描述链辅助定位，到最后一个描述停止执行 action，覆盖 --end-at 命令行参数
  action('waitSceneChange', [操作数组], opts) - 等待场景大幅变化，每次循环执行一次操作数组
    opts: { timeout?, interval?, threshold?, inverse?, recheckCount? }


描述链:
  格式: 描述1#描述2，以半角 # 分隔；至少包含一个描述项；只有一个描述项时不使用 # 分隔符
  举例：'点击前往#进入咖啡店' 或 '进入生存索引'

一般操作:
  tt(x,y) - touch tap
  pc(selector) - 元素点击
  hold(x, y, duration?) - 长按(duration默认100ms)
  drag(fromX, fromY, toX, toY, duration?) - 拖拽(duration默认500ms)
  sleep(ms) - 延时等待
  mi(msg, timeout?) - 请求人工干预，触摸后按 Alt+M 继续 (timeout默认60000ms)
  ts(x, y) - 触摸开始; 如无特别需求，推荐使用 tt (touch tap)/hold/drag
  te() - 触摸结束; 如无特别需求，推荐使用 tt (touch tap)/hold/drag
  tm(x, y) - 触摸移动; 如无特别需求，推荐使用 tt (touch tap)/hold/drag
`,
                    );
                    rl.prompt();
                    return;
                }
            }
            try {
                // 允许访问 browser, page, puppeteer, log 及别名
                // 例外：允许使用 console.error 而不是 log/logRaw
                const result = await _replEval(
                    `(async () =>{try{${enableEnhanced ? "return " : ""}${input}}
catch(e){console.error(e);return '（代码出错）'}})()`,
                );
                log("执行结果:", result);
            } catch (e) {
                log("ERROR:", e);
            }
            rl.prompt();
        }).on("close", async () => {
            _activeRl = null;
            log("REPL结束，关闭浏览器...");
            await screenshot("退出前").catch(() => {});
            await browser.close();
            process.exit(0);
        });
    };
    /**
     * 设置任务超时，超时后自动关闭浏览器并退出进程，多次调用将重置超时
     * @param {number} [ms=1800000] 超时毫秒数，<=0 时取消超时，默认 30 分钟
     * @returns {() => void} 取消超时的函数
     */
    const setTaskTimeout = (
        ms = config.automation?.defaultTaskTimeoutMs ?? 30 * 60 * 1000,
    ) => {
        if (ms <= 0) {
            if (_taskTimer) clearTimeout(_taskTimer);
            _taskTimer = null;
            return () => {};
        }
        if (_taskTimer) clearTimeout(_taskTimer);
        log(`设置任务超时: ${ms}ms`);
        _taskTimer = setTimeout(async () => {
            log(`WARNING: 任务超时(${ms}ms)，正在关闭浏览器...`);
            await screenshot("退出前").catch(() => {});
            try {
                await browser.close();
            } catch (e) {
                logRaw("ERROR: 关闭浏览器失败:", e);
            }
            process.exit(1);
        }, ms);
        return () => {
            if (_taskTimer) clearTimeout(_taskTimer);
            _taskTimer = null;
        };
    };

    /**
     * 截图并保存到日志目录，1秒内限一张
     *
     * @overload
     * @param {string} [label] 截图标签/日志内容
     * @param {{returnBuffer: true}} options 必须显式传 returnBuffer: true
     * @returns {Promise<Buffer>}
     *
     * @overload
     * @param {string} [label] 截图标签/日志内容
     * @param {{returnBuffer?: false}} [options] 不返回 Buffer
     * @returns {Promise<string>} 保存的文件路径
     *
     * @param {string} [label="无描述"] 截图标签/日志内容
     * @param {AutoGamer.ScreenshotOptions} [options={}] 选项
     * @returns {Promise<string | Buffer>} returnBuffer 为 true 时返回 Buffer，否则返回文件路径
     * @throws {Error} 以下情况抛出：options.clip 属性不完整；触发节流（throttleMs 内已有截图）；
     *                 上一张截图正在处理中；截图超时；puppeteer 截图失败
     */
    const screenshot = async (label = "无描述", options = {}) => {
        const returnBuffer = Boolean(options.returnBuffer) === true;
        if (config.isDev && !_devScreenshotWarned) {
            _devScreenshotWarned = true;
            logRaw("WARNING: 开发模式下截图将写入项目临时目录:", logDir);
        }
        const now = Date.now();
        const throttleMs = config.screenshots?.screenshotThrottleMs ?? 750;
        let msg = "";
        if (now - _lastScreenshotTime < throttleMs) msg = "截图失败: 触发节流";
        if (_screenshotInProgress) msg = "截图失败: 上一张截图正在处理中";
        if (msg) {
            logRaw(msg);
            throw new Error(msg);
        }
        // clip 校验：未提供时使用默认视口（全屏）；提供时必须包含完整属性
        /** @type {{x: number, y: number, width: number, height: number} | undefined} */
        let clip;
        if (options.clip !== undefined && options.clip !== null) {
            const c = options.clip;
            if (
                typeof c !== "object" ||
                c.x === undefined ||
                c.y === undefined ||
                c.width === undefined ||
                c.height === undefined
            ) {
                throw new Error("clip 属性不完整，需包含 x, y, width, height");
            }
            clip = {
                x: Number(c.x),
                y: Number(c.y),
                width: Number(c.width),
                height: Number(c.height),
            };
        }
        let overlayWasVisible = false;
        let crosshairWasVisible = false;
        let scrollX = 0;
        let scrollY = 0;
        _lastScreenshotTime = now;
        _screenshotInProgress = true;

        try {
            logRaw("准备截图");
            ({
                overlayVisible: overlayWasVisible,
                crossVisible: crosshairWasVisible,
                scrollX,
                scrollY,
            } = await page.evaluate(() => {
                const overlay = document.getElementById("auto-gamer-overlay");
                const indicator = document.getElementById(
                    "auto-gamer-mouse-indicator",
                );
                const crossH = document.getElementById(
                    "auto-gamer-crosshair-h",
                );
                const crossV = document.getElementById(
                    "auto-gamer-crosshair-v",
                );
                const crossLabel = document.getElementById(
                    "auto-gamer-crosshair-label",
                );

                const overlayVisible =
                    overlay?.style.getPropertyValue("display") !== "none";
                const crossVisible =
                    crossH?.style.getPropertyValue("display") !== "none";

                overlay?.style.setProperty("display", "none", "important");
                indicator?.style.setProperty("display", "none", "important");
                crossH?.style.setProperty("display", "none", "important");
                crossV?.style.setProperty("display", "none", "important");
                crossLabel?.style.setProperty("display", "none", "important");

                return {
                    overlayVisible,
                    crossVisible,
                    scrollX: window.scrollX,
                    scrollY: window.scrollY,
                };
            }));

            const screenshotOptions = {
                fullPage: false,
                clip: clip || {
                    x: scrollX,
                    y: scrollY,
                    width: config.viewport?.width ?? 640,
                    height: config.viewport?.height ?? 480,
                },
                captureBeyondViewport: false,
                optimizeForSpeed: true,
            };

            const raceTimeout = new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error("截图超时")),
                    throttleMs - 100,
                ),
            );

            if (returnBuffer) {
                const buffer = await Promise.race([
                    page.screenshot(screenshotOptions),
                    raceTimeout,
                ]);
                logRaw("截图已获取(buffer)");
                return Buffer.from(/** @type {Buffer} */ (buffer));
            }

            const timeStr = formatLocalTimeWithTz();
            const safeLabel = String(label)
                .replace(/[/\\?%*:|"<>\n\r\t]/g, "_")
                .substring(0, 80);
            const filename = safeLabel
                ? `${timeStr}_${safeLabel}.png`
                : `${timeStr}.png`;
            const filePath = path.join(logDir, filename);

            await Promise.race([
                page.screenshot({ ...screenshotOptions, path: filePath }),
                raceTimeout,
            ]);
            logRaw("截图已保存:", filename);
            return filePath;
        } catch (e) {
            logRaw("截图失败:", /** @type {any} */ (e).message || e);
            throw e;
        } finally {
            try {
                await page.evaluate(
                    ({ wasVisible, crossVisible }) => {
                        const overlay =
                            document.getElementById("auto-gamer-overlay");
                        if (overlay) {
                            overlay.style.setProperty(
                                "display",
                                wasVisible ? "block" : "none",
                                "important",
                            );
                        }

                        const indicator = document.getElementById(
                            "auto-gamer-mouse-indicator",
                        );
                        indicator?.style.setProperty(
                            "display",
                            "block",
                            "important",
                        );

                        const crossDisplay = crossVisible ? "block" : "none";
                        const crossH = document.getElementById(
                            "auto-gamer-crosshair-h",
                        );
                        const crossV = document.getElementById(
                            "auto-gamer-crosshair-v",
                        );
                        const crossLabel = document.getElementById(
                            "auto-gamer-crosshair-label",
                        );
                        crossH?.style.setProperty(
                            "display",
                            crossDisplay,
                            "important",
                        );
                        crossV?.style.setProperty(
                            "display",
                            crossDisplay,
                            "important",
                        );
                        crossLabel?.style.setProperty(
                            "display",
                            crossDisplay,
                            "important",
                        );
                    },
                    {
                        wasVisible: overlayWasVisible,
                        crossVisible: crosshairWasVisible,
                    },
                );
            } catch (_) {}
            _screenshotInProgress = false;
        }
    };

    /**
     * 启动定时自动截图
     * @param {number} [interval=30000] 间隔毫秒数
     * @returns {() => void} 停止定时器的函数
     */
    const startAutoScreenshot = (
        interval = config.screenshots?.autoScreenshotInterval ?? 30000,
    ) => {
        if (_autoScreenshotTimer) clearInterval(_autoScreenshotTimer);
        _autoScreenshotTimer = setInterval(() => {
            screenshot("auto")
                .then(() => logRaw("自动截图成功"))
                .catch(() => {});
        }, interval);
        return () => {
            if (_autoScreenshotTimer) clearInterval(_autoScreenshotTimer);
            _autoScreenshotTimer = null;
            screenshot("退出前").catch(() => {});
        };
    };

    /**
     * 比对当前页面截图与指定 PNG 文件的相似度
     *
     * 注意：当前页面截图与指定 PNG 文件的尺寸必须完全相同，否则会抛出异常
     * （截图尺寸由 config.viewport 或 clip 决定，PNG 文件应使用相同尺寸）
     *
     * pngPath 支持绝对路径和相对路径：
     * - 绝对路径：直接使用
     * - 相对路径：依次尝试 <脚本目录>/resources/<pngPath> 和 <项目根目录>/<pngPath>
     *   （脚本目录需要 ctx 中包含 dataDir 和 scriptId）
     *
     * @param {string} pngPath PNG 文件路径（绝对路径或相对路径）
     * @param {AutoGamer.CompareScreenshotOptions} [options] 配置选项
     * @returns {Promise<boolean>} 满足条件（相似度 >= threshold，或 inverse 时相似度 < threshold）时返回 true
     * @throws {Error} 图片尺寸不一致、clip 属性不完整（透传 screenshot）或读取失败时抛出
     */
    const compareScreenshot = async (pngPath, options = {}) => {
        /** @type {AutoGamer.CompareScreenshotOptions} */
        const opts =
            typeof options === "object" && options !== null ? options : {};
        const thresholdRaw = Number(opts.threshold);
        const threshold = Number.isNaN(thresholdRaw)
            ? 0.9
            : Math.min(1, Math.max(0, thresholdRaw));
        const inverse = Boolean(opts.inverse);
        const recheckCount = Math.max(
            0,
            Math.floor(Number(opts.recheckCount) || 0),
        );
        const recheckInterval = Math.max(
            200,
            Number(opts.recheckInterval) || 3000,
        );

        // 解析 pngPath：绝对路径直接使用，相对路径依次尝试脚本目录/resources 和项目根目录
        /** @type {string} */
        let resolvedPath;
        if (path.isAbsolute(pngPath)) {
            resolvedPath = pngPath;
        } else {
            const scriptDataDir = /** @type {AutoGamer.ScriptCtx} */ (ctx)
                .dataDir;
            const scriptId = /** @type {AutoGamer.ScriptCtx} */ (ctx).scriptId;
            // 脚本目录/resources/<pngPath>
            const scriptResourcePath =
                scriptDataDir && scriptId
                    ? path.join(
                          scriptDataDir,
                          "scripts",
                          scriptId,
                          "resources",
                          pngPath,
                      )
                    : null;
            // 项目根目录/<pngPath>
            const projectRootPath = path.join(
                /** @type {string} */ (require.main?.path ?? process.cwd()),
                pngPath,
            );

            if (scriptResourcePath && fs.existsSync(scriptResourcePath)) {
                resolvedPath = scriptResourcePath;
            } else if (fs.existsSync(projectRootPath)) {
                resolvedPath = projectRootPath;
            } else {
                // 都找不到，尝试脚本目录/resources 作为默认值，让 readFileSync 报错提示
                resolvedPath = scriptResourcePath || projectRootPath;
            }
        }

        const fileBuffer = _getFileBuffer(resolvedPath);
        // 截图重试：screenshot 可能因节流/并发/超时等抛错，重试以增强健壮性
        const maxRetries = 3;
        const retryDelay = 3000;
        const takeScreenshot = async () => {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    return await screenshot("compareScreenshot", {
                        returnBuffer: true,
                        ...(opts.clip ? { clip: opts.clip } : {}),
                    });
                } catch (e) {
                    if (attempt === maxRetries) throw e;
                    log(
                        `WARNING: compareScreenshot 截图失败(第${attempt}/${maxRetries}次)，${retryDelay}ms 后重试:`,
                        /** @type {any} */ (e).message || e,
                    );
                    await sleep(retryDelay);
                }
            }
            // unreachable
            throw new Error("compareScreenshot 截图失败");
        };

        const baseName = path.basename(pngPath);
        let recheckPassed = 0;

        while (true) {
            const currentBuffer = await takeScreenshot();
            const similarity = calculateSimilarity(fileBuffer, currentBuffer);
            const conditionMet = inverse
                ? similarity < threshold
                : similarity >= threshold;
            const recheckTag =
                recheckCount >= 1
                    ? ` 复查 ${recheckPassed}/${recheckCount}`
                    : "";
            log(
                `截图与 ${baseName} 相似度: ${similarity.toFixed(4)} (阈值 ${threshold})${recheckTag}`,
            );

            if (!conditionMet) {
                if (recheckPassed > 0) {
                    log(
                        `复查条件不再满足，返回 false (已通过 ${recheckPassed}/${recheckCount})`,
                    );
                }
                return false;
            }

            if (recheckCount < 1) {
                return true;
            }

            recheckPassed++;
            if (recheckPassed >= recheckCount) {
                log(`复查全部通过 (${recheckCount}/${recheckCount})`);
                return true;
            }

            await sleep(recheckInterval);
        }
    };

    return {
        ts,
        te,
        tm,
        tt,
        pc,
        hold,
        sleep,
        mi,
        startRepl,
        drag,
        setTaskTimeout,
        screenshot,
        startAutoScreenshot,
        compareScreenshot,
        setBeforeUnload,
        action,
    };
}

module.exports = { createUtils, formatLocalTimeWithTz };
