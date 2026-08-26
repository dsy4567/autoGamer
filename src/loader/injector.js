/**
 * @fileoverview autoGamer 主程序，负责初始化环境、运行脚本等。
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check
"use strict";

const fs = require("fs");
const path = require("path");

const { log } = require("../logger");
const config = require("../config.default.js");

let currentWidth = config.viewport.width,
    currentHeight = config.viewport.height;
/** 获取当前缩放比例 */
function getScale() {
    const scaleX = config.viewport.width / currentWidth; // e.g. 640px / 582px ≈ 1.0996563573883162
    const scaleY = config.viewport.height / currentHeight; // e.g. 480px / 436px ≈ 1.0996563573883162
    return { scaleX, scaleY };
}
/**
 * 计算缩放比例后的坐标，其结果不建议跨函数传递
 * @param {number | null} x x 坐标
 * @param {number | null} y y 坐标
 * @returns {{x: number, y: number}} 缩放比例后的坐标
 * */
function posWithScale(x, y) {
    return {
        x: Math.round(Number(x) * (config.viewport.width / currentWidth)),
        y: Math.round(Number(y) * (config.viewport.height / currentHeight)),
    };
}

/**
 * 注入 injectPage.js 到页面
 * @param {object} fns
 * @param {import("puppeteer-core").Page} fns.page
 * @param {(x: number, y: number) => any} fns.tt
 * @param {(x: number, y: number, toX: number, toY: number, duration: number | undefined) => any} fns.drag
 * @param {(x: number, y: number, duration: number | undefined) => any} fns.hold
 * @param {(() => Promise<void>) | undefined} [fns.manualPauseHandler] 手动暂停回调（Alt+M 触发），由 createUtils 提供
 * @param {((label?: string, options?: any) => Promise<string | Buffer>) | undefined} [fns.screenshot] 截图函数（Alt+P 触发），由 createUtils 提供；因 utils.js 的 screenshot 带 JSDoc 重载（returnBuffer/returnBase64 模式），无法精确赋给单一函数签名，options 放宽为 any
 */
async function inject(fns) {
    const { page, tt, drag, hold, manualPauseHandler, screenshot } = fns;
    async function _rewriteWebdriver() {
        await page.evaluateOnNewDocument(() => {
            // 隐藏 navigator.webdriver，绕过最常见的 Puppeteer/自动化检测
            Object.defineProperty(navigator, "webdriver", { value: false });
        });
    }
    async function _initAutoGamerObj() {
        await page.evaluateOnNewDocument(() => {
            window.__autoGamer = window.__autoGamer || {};
            window.__autoGamer.config = window.__autoGamer.config || {};
        });
    }
    async function _simulateTouch() {
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
            if (!window.__autoGamer || !window.__autoGamer.config) return;
            if (window.__autoGamer.simulateTouch) return;
            window.__autoGamer.simulateTouch = window.__autoGamerSimulateTouch;

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
                    window.__autoGamer?.simulateTouch?.(ev.data);
                }
            });

            // 将全局配置注入页面，供 injectPage.js 读取
            window.__autoGamer.config.alwaysHideOverlay = alwaysHideOverlay;
        }, config.alwaysHideOverlay ?? false);
    }
    async function _ScaleChangeListener() {
        await page.exposeFunction(
            "__autoGamerSetScale",
            /** @param {number} width @param {number} height */
            (width, height) => {
                currentWidth = width;
                currentHeight = height;
            },
        );
        await page.evaluateOnNewDocument(
            viewport => {
                if (!window.__autoGamer || !window.__autoGamer.config) return;
                window.__autoGamer.setScale = window.__autoGamerSetScale;
                window.__autoGamer.config.viewport = window.__autoGamer.config
                    .viewport || {
                    width: viewport.width,
                    height: viewport.height,
                };
                window.__autoGamer.config.viewport.width = viewport.width;
                window.__autoGamer.config.viewport.height = viewport.height;
            },
            { width: config.viewport.width, height: config.viewport.height },
        );
    }
    async function _manualPause() {
        if (typeof manualPauseHandler !== "function") return;
        // 暴露 node 端 manualPauseHandler 给页面端调用，Alt+M 触发时转发
        await page.exposeFunction(
            "__autoGamerManualPauseTrigger",
            manualPauseHandler,
        );
        await page.evaluateOnNewDocument(() => {
            if (!window.__autoGamer || !window.__autoGamer.config) return;
            if (window.__autoGamer.manualPauseTrigger) return;
            window.__autoGamer.manualPauseTrigger =
                window.__autoGamerManualPauseTrigger;
        });
    }
    async function _manualScreenshot() {
        if (typeof screenshot !== "function") return;
        // 暴露 node 端截图函数给页面端调用，Alt+P 触发时转发；
        // 截图自动保存到日志目录，成功返回 base64 字符串，失败返回 null
        await page.exposeFunction(
            "__autoGamerManualScreenshot",
            /**
             * @param {{ clip?: { x: number, y: number, width: number, height: number } } | null | undefined} [msg]
             * @returns {Promise<string | null>}
             */
            async msg => {
                const clip =
                    msg && typeof msg === "object" ? msg.clip : undefined;
                try {
                    const result = await screenshot(
                        clip ? "手动选区截图" : "手动全屏截图",
                        clip
                            ? { clip, returnBase64: true }
                            : { returnBase64: true },
                    );
                    return typeof result === "string" ? result : null;
                } catch (e) {
                    log(
                        "ERROR: 手动截图失败:",
                        /** @type {any} */ (e)?.message ?? e,
                    );
                    return null;
                }
            },
        );
        await page.evaluateOnNewDocument(() => {
            if (!window.__autoGamer || !window.__autoGamer.config) return;
            if (window.__autoGamer.manualScreenshot) return;
            window.__autoGamer.manualScreenshot =
                window.__autoGamerManualScreenshot;
        });
    }

    try {
        const injectPath = path.resolve(__dirname, "../browser/injectPage.js");

        await _rewriteWebdriver();
        await _initAutoGamerObj();
        await _simulateTouch();
        await _ScaleChangeListener();
        await _manualPause();
        await _manualScreenshot();

        let identifier = (
            await page.evaluateOnNewDocument(
                fs.readFileSync(injectPath, "utf-8"),
            )
        ).identifier;

        // 热重载
        let lastInjectTime = 0;
        config.isDev &&
            fs.watch(injectPath, async () => {
                if (Date.now() - lastInjectTime < 300) return;
                lastInjectTime = Date.now();
                log("injectPage.js 已更新，重新注入");
                await page.removeScriptToEvaluateOnNewDocument(identifier);
                identifier = (
                    await page.evaluateOnNewDocument(
                        fs.readFileSync(injectPath, "utf-8"),
                    )
                ).identifier;
            });

        log("已注入 injectPage.js");
    } catch (e) {
        log("ERROR: 注入 injectPage.js 失败:", e);
    }
}

module.exports = { inject, getScale };
