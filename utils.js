/**
 * @fileoverview 提供一些实用工具函数
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: MIT
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
// 放在模块作用域，确保全局只有一个 waitSceneChange 在执行
let _waitSceneChangeInProgress = false;

// 放在模块作用域，确保 createUtils 多次调用时 action 的 start-at/end-at 状态全局共享
/** --start-at 解析后的描述链（null 表示未指定） @type {string[] | null} */
let _actionStartAtChain = null;
/** 当前已匹配到 start-at 链的第几个索引 */
let _actionStartAtIndex = 0;
/** 是否已到达 start-at 锚点 */
let _actionStartAtReached = false;
/** --end-at 解析后的描述链（null 表示未指定） @type {string[] | null} */
let _actionEndAtChain = null;
/** 当前已匹配到 end-at 链的第几个索引 */
let _actionEndAtIndex = 0;
/** 是否已到达 end-at 锚点 */
let _actionEndAtReached = false;
/** 是否已执行完 end-at 锚点 action，后续应全部跳过 */
let _actionEndAtPassed = false;
/** action 状态是否已完成初始化（仅从 ctx 解析一次） */
let _actionStateInitialized = false;
/** action 调试模式是否开启 */
let _actionDbgEnabled = false;
/** 调试模式下挂起的 action 任务队列 @type {Array<{resolve: (value?: any) => void, reject: (e?: any) => void, task: () => Promise<void>, description: string}>} */
let _actionDbgQueue = [];

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
    const png1 = PNG.sync.read(buf1);
    const png2 = PNG.sync.read(buf2);

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
 * @param {AutoGamer.UtilsCtx} ctx
 * @param {AutoGamer.EvalFn} [_eval=eval] 用于 REPL 中执行代码的 eval 函数
 */
function createUtils(ctx, _eval = eval) {
    const { puppeteer, browser, page, log, logRaw, pageOpenTime, logDir } = ctx;

    // 从 ctx 初始化 --start-at / --end-at 描述链（仅初始化一次，后续 action("startAt"/"endAt") 可覆盖）
    if (!_actionStateInitialized) {
        _actionStateInitialized = true;
        _actionStartAtChain = ctx.startAtChain ?? null;
        _actionEndAtChain = ctx.endAtChain ?? null;
    }

    /**
     * 触摸开始 - 在指定坐标触发 touchStart 事件；如无特别需求，推荐使用 {@link tt} (touch tap) {@link hold} {@link drag}
     * @param {number} x 横坐标
     * @param {number} y 纵坐标
     */
    const ts = (x, y) => page.touchscreen.touchStart(x, y);
    /** 触摸结束 - 触发 touchEnd 事件；如无特别需求，推荐使用 {@link tt} (touch tap) {@link hold} {@link drag} */
    const te = () => page.touchscreen.touchEnd();
    /**
     * 触摸移动 - 在指定坐标触发 touchMove 事件；如无特别需求，推荐使用 {@link tt} (touch tap) {@link hold} {@link drag}
     * @param {number} x 横坐标
     * @param {number} y 纵坐标
     */
    const tm = (x, y) => page.touchscreen.touchMove(x, y);
    /**
     * 触摸点击 - 在指定坐标触发 tap 事件
     * @param {number} x 横坐标
     * @param {number} y 纵坐标
     */
    const tt = (x, y) => page.touchscreen.tap(x, y);
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
        // 特殊指令：覆盖 start-at
        if (description === "startAt") {
            const chain =
                typeof operations === "string"
                    ? operations.split("#")
                    : Array.isArray(operations)
                      ? operations
                      : null;
            if (!chain) {
                log(
                    "WARNING: action startAt 参数无效，应为 string 或 string[]",
                );
                return;
            }
            _actionStartAtChain = chain;
            _actionStartAtIndex = 0;
            _actionStartAtReached = false;
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
            if (!chain) {
                log("WARNING: action endAt 参数无效，应为 string 或 string[]");
                return;
            }
            _actionEndAtChain = chain;
            _actionEndAtIndex = 0;
            _actionEndAtReached = false;
            _actionEndAtPassed = false;
            log(`action endAt 已覆盖: ${chain.join("#")}`);
            return;
        }

        // 特殊指令：切换调试模式
        if (description === "toggleDbg") {
            _actionDbgEnabled = !_actionDbgEnabled;
            log(`action 调试模式: ${_actionDbgEnabled ? "开启" : "关闭"}`);
            if (!_actionDbgEnabled && _actionDbgQueue.length > 0) {
                log(
                    `action 调试模式关闭，自动兑现 ${_actionDbgQueue.length} 个挂起任务`,
                );
                const queue = _actionDbgQueue.splice(0, _actionDbgQueue.length);
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
            const nextAction = _actionDbgQueue.shift();
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
            const skipAction = _actionDbgQueue.shift();
            if (!skipAction) {
                log("WARNING: action skip 无挂起的调试任务");
                return;
            }
            const { resolve, description: taskDesc } = skipAction;
            log(`action skip 跳过: ${taskDesc}`);
            resolve();
            return;
        }

        if (description.includes("#")) {
            log(
                "WARNING: action 简要描述包含半角 # 字符，可能影响 --start-at / --end-at 的匹配结果",
            );
        }

        // --start-at：未到达锚点前跳过
        if (_actionStartAtChain && !_actionStartAtReached) {
            if (description === _actionStartAtChain[_actionStartAtIndex]) {
                _actionStartAtIndex++;
                if (_actionStartAtIndex === _actionStartAtChain.length) {
                    _actionStartAtReached = true;
                }
            }
            if (!_actionStartAtReached) {
                return;
            }
        }

        // --end-at：已越过锚点后跳过
        if (_actionEndAtPassed) {
            return;
        }

        // --end-at：推进匹配进度，若当前 action 恰好是锚点，执行完后标记越过
        let shouldPassAfterThis = false;
        if (_actionEndAtChain && !_actionEndAtReached) {
            if (description === _actionEndAtChain[_actionEndAtIndex]) {
                _actionEndAtIndex++;
                if (_actionEndAtIndex === _actionEndAtChain.length) {
                    _actionEndAtReached = true;
                    shouldPassAfterThis = true;
                }
            }
        }

        /** action 核心执行逻辑 */
        const _runActionCore = async () => {
            // 特殊操作：等待场景大幅变化
            if (description === "waitSceneChange") {
                if (_waitSceneChangeInProgress) {
                    throw new Error("waitSceneChange 已有实例正在执行中");
                }
                _waitSceneChangeInProgress = true;
                try {
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
                        if (shouldPassAfterThis) _actionEndAtPassed = true;
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
                        prevBuffer = fs.readFileSync(referenceFile);
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
                                    e,
                                );
                                await sleep(3000);
                            }
                        }
                    }

                    let recheckPassed = 0; // 已通过的复查次数
                    let inRecheckPhase = false; // 是否进入复查阶段

                    while (true) {
                        const elapsed = Date.now() - startTime;
                        if (elapsed >= timeout) {
                            throw new Error("等待场景变化超时");
                        }

                        const currentInterval = inRecheckPhase
                            ? recheckInterval
                            : normalInterval;
                        const waitTime = Math.min(
                            currentInterval,
                            timeout - elapsed,
                        );
                        await sleep(waitTime);

                        // 复查阶段为纯观察阶段，暂停执行 operations 数组，避免干扰验证
                        if (!inRecheckPhase) {
                            for (const op of operations || []) {
                                if (op[0] === "fn") {
                                    // 自定义函数操作：["fn", (desc, ctx, ...args) => any, [...args]]
                                    // 通过 await 执行，不处理抛错
                                    const fnOp = /** @type {any} */ (op);
                                    /** @type {(desc: string, ctx: any, ...args: any[]) => any} */
                                    const userFn = fnOp[1];
                                    /** @type {any[]} */
                                    const userArgs = fnOp[2] || [];
                                    await userFn(description, ctx, ...userArgs);
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
                                    })[fnName];
                                if (!fn) {
                                    log(
                                        `WARNING: waitSceneChange 中存在未知操作 "${fnName}"，已跳过`,
                                    );
                                    continue;
                                }
                                await fn(...args);
                            }
                        }

                        if (Date.now() - startTime >= timeout) {
                            throw new Error("等待场景变化超时");
                        }

                        let currentBuffer;
                        try {
                            currentBuffer =
                                await takeScreenshot("waitSceneChange-比对");
                        } catch (e) {
                            if (Date.now() - startTime >= timeout) {
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
                                    log(
                                        "条件首次满足，进入复查阶段（间隔强制3秒，暂停执行操作数组）",
                                    );
                                }
                                recheckPassed++;
                                log(
                                    `条件满足，复查进度: ${recheckPassed}/${recheckCount}`,
                                );
                                if (recheckPassed >= recheckCount) {
                                    log(
                                        inverse
                                            ? "场景未发生变化（已复查确认），继续执行"
                                            : "场景已发生大幅变化（已复查确认），继续执行",
                                    );
                                    if (shouldPassAfterThis)
                                        _actionEndAtPassed = true;
                                    return;
                                }
                                // 继续下一次循环进行复查
                            } else {
                                log(
                                    inverse
                                        ? "场景未发生变化，继续执行"
                                        : "场景已发生大幅变化，继续执行",
                                );
                                if (shouldPassAfterThis)
                                    _actionEndAtPassed = true;
                                return;
                            }
                        } else {
                            // 条件不满足，重置复查计数和复查阶段
                            if (recheckPassed > 0) {
                                log(
                                    `条件不再满足，复查计数已重置 (${recheckPassed} → 0)，退出复查阶段`,
                                );
                                recheckPassed = 0;
                                inRecheckPhase = false;
                            }
                        }

                        prevBuffer = currentBuffer;
                    }
                } finally {
                    _waitSceneChangeInProgress = false;
                }
            }

            log("ACTION:", description);

            for (const op of operations || []) {
                if (op[0] === "fn") {
                    // 自定义函数操作：["fn", (desc, ctx, ...args) => any, [...args]]
                    // 通过 await 执行，不处理抛错
                    const fnOp = /** @type {any} */ (op);
                    /** @type {(desc: string, ctx: any, ...args: any[]) => any} */
                    const userFn = fnOp[1];
                    /** @type {any[]} */
                    const userArgs = fnOp[2] || [];
                    await userFn(description, ctx, ...userArgs);
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
                    })[fnName];
                if (!fn) {
                    log(`WARNING: action 中存在未知操作 "${fnName}"，已跳过`);
                    continue;
                }
                await fn(...args);
            }

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
                _actionEndAtPassed = true;
            }
        };

        if (_actionDbgEnabled) {
            log(`action 调试挂起: ${description}`);
            return new Promise((resolve, reject) => {
                _actionDbgQueue.push({
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
        rl.prompt();
        rl.on("line", async input => {
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
                await action("next");
                rl.prompt();
                return;
            }
            if (trimmed === "skip") {
                await action("skip");
                rl.prompt();
                return;
            }
            if (trimmed === "tdbg") {
                await action("toggleDbg");
                rl.prompt();
                return;
            }
            if (trimmed === "help") {
                log(
                    `
获取返回值: 使用 return 语句返回执行结果

可用命令:
  exit          - 退出 REPL 并关闭浏览器
  next          - 调试模式下执行下一个挂起的 action
  skip          - 调试模式下跳过下一个挂起的 action
  tdbg          - 开启/关闭 action 调试模式
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
  ts(x, y) - 触摸开始; 如无特别需求，推荐使用 tt (touch tap)/hold/drag
  te() - 触摸结束; 如无特别需求，推荐使用 tt (touch tap)/hold/drag
  tm(x, y) - 触摸移动; 如无特别需求，推荐使用 tt (touch tap)/hold/drag
`,
                );
                rl.prompt();
                return;
            }
            try {
                // 允许访问 browser, page, puppeteer, log 及别名
                // 例外：允许使用 console.error 而不是 log/logRaw
                const result = await _eval(
                    `(async () => {try{${input}}catch(e){console.error(e)}})()`,
                );
                log("执行结果:", result);
            } catch (e) {
                log("ERROR:", e);
            }
            rl.prompt();
        }).on("close", async () => {
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
        const returnBuffer = options.returnBuffer === true;
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
        _lastScreenshotTime = now;
        _screenshotInProgress = true;

        try {
            logRaw("准备截图");
            overlayWasVisible = await page.evaluate(() => {
                const overlay = document.getElementById("auto-gamer-overlay");
                if (!overlay) return false;

                const visible =
                    overlay.style.getPropertyValue("display") !== "none";
                overlay.style.setProperty("display", "none", "important");

                const indicator = document.getElementById(
                    "auto-gamer-mouse-indicator",
                );
                indicator?.style.setProperty("display", "none", "important");

                return visible;
            });

            const screenshotOptions = {
                fullPage: false,
                clip: clip || {
                    x: 0,
                    y: 0,
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
                return /** @type {Buffer} */ (buffer);
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
            logRaw("截图失败:", /** @type {any} */ (e).message);
            throw e;
        } finally {
            try {
                await page.evaluate(wasVisible => {
                    const overlay =
                        document.getElementById("auto-gamer-overlay");
                    if (overlay) {
                        overlay.style.setProperty(
                            "display",
                            wasVisible ? "block" : "none",
                            "important",
                        );

                        const indicator = document.getElementById(
                            "auto-gamer-mouse-indicator",
                        );
                        indicator?.style.setProperty(
                            "display",
                            "block",
                            "important",
                        );
                    }
                }, overlayWasVisible);
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
     * @param {string} pngPath PNG 文件路径
     * @param {AutoGamer.CompareScreenshotOptions} [options] 配置选项
     * @returns {Promise<boolean>} 满足条件（相似度 >= threshold，或 inverse 时相似度 < threshold）时返回 true
     * @throws {Error} 图片尺寸不一致、clip 属性不完整（透传 screenshot）或读取失败时抛出
     */
    const compareScreenshot = async (pngPath, options = {}) => {
        /** @type {AutoGamer.CompareScreenshotOptions} */
        const opts =
            typeof options === "object" && options !== null ? options : {};
        const threshold = Math.min(
            1,
            Math.max(0, Number(opts.threshold) ?? 0.9),
        );
        const inverse = Boolean(opts.inverse);
        const recheckCount = Math.max(
            0,
            Math.floor(Number(opts.recheckCount) || 0),
        );
        const recheckInterval = Math.max(
            200,
            Number(opts.recheckInterval) || 3000,
        );

        const fileBuffer = fs.readFileSync(pngPath);
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
                } catch (/** @type {any} */ e) {
                    if (attempt === maxRetries) throw e;
                    log(
                        `WARNING: compareScreenshot 截图失败(第${attempt}/${maxRetries}次)，${retryDelay}ms 后重试:`,
                        e.message,
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
        startRepl,
        drag,
        setTaskTimeout,
        screenshot,
        startAutoScreenshot,
        compareScreenshot,
        action,
    };
}

module.exports = { createUtils, formatLocalTimeWithTz };
