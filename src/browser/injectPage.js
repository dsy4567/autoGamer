/**
 * @fileoverview 注入增强功能到游戏页面
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check
/// <reference types="../../userData.default/autoGamer.d.ts" />

"use strict";

window.__autoGamer = window.__autoGamer || {};
if (!window.__autoGamer) throw 0;

window.__autoGamer.mainFn = () => {
    if (
        document.getElementById("auto-gamer-mouse-indicator") ||
        !window.__autoGamer
    )
        return;

    /** @type {{ alwaysHideOverlay?: boolean, viewport?: { width: number, height: number } }} */
    const autoGamerConfig = window.__autoGamer.config || {};
    let alwaysHideOverlay = autoGamerConfig.alwaysHideOverlay || false;

    // #region 创建全屏遮罩元素

    // 创建透明度为 0.01 的全屏遮罩，用于遮挡包括游戏界面、auto-gamer-* 在内的其他所有元素
    const overlay = document.createElement("div");
    overlay.id = "auto-gamer-overlay";
    overlay.style.setProperty("position", "fixed", "important");
    overlay.style.setProperty("top", "0", "important");
    overlay.style.setProperty("left", "0", "important");
    overlay.style.setProperty("width", "100vw", "important");
    overlay.style.setProperty("height", "100vh", "important");
    overlay.style.setProperty("background", "rgba(0,0,0,0.999)", "important");
    // 咪咕快游某个弹窗似乎使用了恰好低于此的 z-index，任何情况下这个遮罩必须在其他元素之上
    // 为确保统一性，其他 auto-gamer 元素的 z-index 应该参考下方 indicator
    overlay.style.setProperty("z-index", "1000001", "important");
    overlay.style.setProperty("pointer-events", "none", "important");
    if (alwaysHideOverlay) {
        overlay.style.setProperty("display", "none", "important");
    }
    document.documentElement.appendChild(overlay);

    // 鼠标移入遮罩时隐藏它
    document.documentElement.addEventListener("mouseenter", function () {
        overlay.style.setProperty("display", "none", "important");
    });

    // 鼠标离开遮罩时重新显示
    document.documentElement.addEventListener("mouseleave", function () {
        if (alwaysHideOverlay) return;
        overlay.style.setProperty("display", "block", "important");
    });

    // #endregion

    // #region Page Visibility API 劫持

    // 挟持 Page Visibility API 及相关事件
    Object.defineProperty(document, "hidden", {
        value: false,
        writable: false,
    });
    Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: false,
    });
    // 屏蔽 visibilitychange/pagehide/pageshow 事件监听
    window.addEventListener = new Proxy(window.addEventListener, {
        apply(target, thisArg, args) {
            const event = args[0];
            if (["visibilitychange", "pagehide", "pageshow"].includes(event)) {
                return;
            }
            return Reflect.apply(target, thisArg, args);
        },
    });
    document.addEventListener = new Proxy(document.addEventListener, {
        apply(target, thisArg, args) {
            const event = args[0];
            if (
                [
                    "visibilitychange",
                    "pagehide",
                    "pageshow",
                    "webkitvisibilitychange",
                ].includes(event)
            ) {
                return;
            }
            return Reflect.apply(target, thisArg, args);
        },
    });
    // 立即触发一次 visibilitychange 事件，确保状态为 visible
    document.dispatchEvent(new Event("visibilitychange"));

    // #endregion

    // #region 创建鼠标坐标指示器元素

    const indicator = document.createElement("div");
    indicator.id = "auto-gamer-mouse-indicator";
    indicator.style.setProperty("position", "fixed", "important");
    indicator.style.setProperty("top", "10px", "important");
    indicator.style.setProperty("left", "10px", "important");
    indicator.style.setProperty("opacity", "0.8", "important");
    indicator.style.setProperty("padding", "6px 12px", "important");
    indicator.style.setProperty("background", "rgb(0,0,0)", "important");
    indicator.style.setProperty("color", "#fff", "important");
    indicator.style.setProperty("border-radius", "6px", "important");
    indicator.style.setProperty("font-size", "14px", "important");
    indicator.style.setProperty("z-index", "9999", "important");
    indicator.style.setProperty("pointer-events", "none", "important");
    indicator.style.setProperty("transition", "opacity 0.3s", "important");
    indicator.style.setProperty("font-family", "cursive", "important");
    // indicator.textContent = "X: 0, Y: 0";
    document.documentElement.appendChild(indicator);

    // #endregion

    // #region 十字交叉线（触摸点指示）

    // 十字交叉线 + 坐标标签：展示最后一个触摸点
    // mix-blend-mode: difference 实现透明反色；不使用外层容器，各元素直接与游戏画面混合，
    // 避免父级 stacking context 阻断 difference
    /** @type {[string, string][]} */
    const crosshairCommonStyle = [
        ["position", "fixed"],
        ["top", "0"],
        ["left", "0"],
        ["margin", "0"],
        ["mix-blend-mode", "difference"],
        ["z-index", "10000"],
        ["pointer-events", "none"],
        ["display", "none"],
        ["transform", "translate3d(0,0,0)"],
    ];
    /**
     * 批量以 important 优先级设置样式
     * @param {HTMLElement} el
     * @param {[string, string][]} styles
     */
    const applyStyle = (el, styles) => {
        for (const [k, v] of styles) el.style.setProperty(k, v, "important");
    };

    const crosshairH = document.createElement("div");
    crosshairH.id = "auto-gamer-crosshair-h";
    applyStyle(crosshairH, crosshairCommonStyle);
    applyStyle(crosshairH, [
        ["width", "100vw"],
        ["height", "1px"],
        ["background", "rgba(255,255,255,0.8)"],
    ]);
    document.documentElement.appendChild(crosshairH);

    const crosshairV = document.createElement("div");
    crosshairV.id = "auto-gamer-crosshair-v";
    applyStyle(crosshairV, crosshairCommonStyle);
    applyStyle(crosshairV, [
        ["width", "1px"],
        ["height", "100vh"],
        ["background", "rgba(255,255,255,0.8)"],
    ]);
    document.documentElement.appendChild(crosshairV);

    // 紧挨十字线交点的坐标标签，无背景、反色
    const crosshairLabel = document.createElement("div");
    crosshairLabel.id = "auto-gamer-crosshair-label";
    applyStyle(crosshairLabel, crosshairCommonStyle);
    applyStyle(crosshairLabel, [
        ["background", "transparent"],
        ["color", "rgba(255,255,255,0.8)"],
        ["font-size", "12px"],
        ["line-height", "1"],
        ["white-space", "nowrap"],
    ]);
    document.documentElement.appendChild(crosshairLabel);

    /** 十字线开关（Alt+X 切换），关闭后触摸也不显示 */
    let crosshairEnabled = true;
    /** 是否已通过 updateCrosshair 激活过（激活后才显示十字线） */
    let crosshairTouched = false;
    /** @type {{x: number, y: number} | null} 上次操作的最终坐标（用于连续同位置操作计数） */
    let lastOpPos = null;
    /** 连续同位置操作次数 */
    let opCount = 0;
    /** @type {{x: number, y: number} | null} 当前触摸的最后坐标（tap 为点击位置，drag 为最后停留坐标） */
    let touchLastPos = null;
    /**
     * 根据 crosshairEnabled 与 crosshairTouched 同步十字线与标签的可见性
     */
    const updateCrosshairVisibility = () => {
        const show = crosshairEnabled && crosshairTouched ? "block" : "none";
        crosshairH.style.setProperty("display", show, "important");
        crosshairV.style.setProperty("display", show, "important");
        crosshairLabel.style.setProperty("display", show, "important");
    };
    /**
     * 渲染十字线交点位置与坐标标签（仅更新 DOM，不记录操作）
     * @param {number} x
     * @param {number} y
     * @param {number} [count] - 连续同位置操作次数，> 1 时显示 xN 标注
     */
    const renderCrosshair = (x, y, count = 0) => {
        crosshairH.style.setProperty(
            "transform",
            `translate3d(0,${y}px,0)`,
            "important",
        );
        crosshairV.style.setProperty(
            "transform",
            `translate3d(${x}px,0,0)`,
            "important",
        );
        const countLabel = count > 1 ? ` x${count}` : "";
        crosshairLabel.textContent = `(${Math.round(x)},${Math.round(y)})${countLabel}`;
        // 标签紧贴交点右下方，偏移 4px 避免遮挡交点
        // 标签本身的位置不能超出视口，超出时紧贴视口边缘
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const lw = crosshairLabel.offsetWidth;
        const lh = crosshairLabel.offsetHeight;
        const lx = lw > 0 ? Math.max(0, Math.min(x + 4, vw - lw)) : x + 4;
        const ly = lh > 0 ? Math.max(0, Math.min(y + 4, vh - lh)) : y + 4;
        crosshairLabel.style.setProperty(
            "transform",
            `translate3d(${lx}px,${ly}px,0)`,
            "important",
        );
    };

    /**
     * 手动更新十字线坐标并记录操作次数（用于重复点击计数）
     *
     * 通过 window.__autoGamer.updateCrosshair(x, y) 调用，
     * 将十字线移动到指定坐标、标记为已触摸并显示，
     * 同时与上次操作位置比较，连续同位置（阈值 5px）操作累加计数。
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     */
    const updateCrosshair = (x, y) => {
        crosshairTouched = true;
        touchLastPos = { x, y };
        if (lastOpPos && x == lastOpPos.x && y == lastOpPos.y) {
            opCount++;
        } else {
            opCount = 1;
        }
        lastOpPos = { x, y };
        renderCrosshair(x, y, opCount);
        updateCrosshairVisibility();
    };

    window.__autoGamer.updateCrosshair = updateCrosshair;

    // #endregion

    // #region 鼠标坐标指示器更新逻辑

    let altPressed = false;
    /** 人工干预激活时为 true，使指示器保持可见 */
    let miActive = false;
    /** 是否将生成的操作代码写入剪贴板（默认关，Alt+C 切换） */
    let clipboardEnabled = false;

    let mousePos = {
            x: 0,
            y: 0,
        },
        extraContent = "",
        extraHtml = "",
        /** @type {number|undefined} - 用于延迟显示指示器的定时器 ID */
        setOpacityTimer = undefined;
    /**
     * 更新指示器的坐标和额外内容
     * @param {number|null|string} _x - 鼠标 X 坐标
     * @param {number|null|string} _y - 鼠标 Y 坐标
     * @param {string} _extraContent - 额外的文本内容
     * @param {string} _extraHtml - 额外的 HTML 内容
     */
    const updateIndicator = (
        _x = null,
        _y = null,
        _extraContent = "",
        _extraHtml = "",
    ) => {
        if (_x !== null && _x !== undefined && _x !== "") mousePos.x = +_x;
        if (_y !== null && _y !== undefined && _y !== "") mousePos.y = +_y;
        if (_extraHtml) extraHtml = _extraHtml;
        if (_extraContent)
            extraContent =
                _extraContent.substring(0, 80) +
                (_extraContent.length > 80 ? "..." : "");
        // 鼠标距页面顶部 <= <像素> 时，指示器靠下显示，避免遮挡
        if (mousePos.y <= 240) {
            indicator.style.setProperty("top", "auto", "important");
            indicator.style.setProperty("bottom", "10px", "important");
        } else {
            indicator.style.setProperty("bottom", "auto", "important");
            indicator.style.setProperty("top", "10px", "important");
        }
        indicator.textContent = `${
            altPressed ? " [Alt模式]" : " [Alt+H获取帮助]"
        }${clipboardEnabled ? " [剪贴板开]" : ""}${extraContent}`;
        indicator.innerHTML += `<br><span>X: ${mousePos.x}, Y: ${mousePos.y}</span><br>${extraHtml}`;
    };
    const showIndicator = () => {
        indicator.style.setProperty("opacity", "0.8", "important");
        window.clearTimeout(setOpacityTimer);
        if (altPressed || miActive) return;
        setOpacityTimer = window.setTimeout(() => {
            indicator.style.setProperty("opacity", "0.3", "important");
        }, 3000);
    };
    updateIndicator();
    showIndicator();

    // 鼠标移动时更新坐标
    document.addEventListener("mousemove", function (e) {
        updateIndicator(e.clientX, e.clientY);
        showIndicator();
    });

    document.addEventListener("touchmove", function (e) {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            updateIndicator(touch.clientX, touch.clientY);
            showIndicator();
        }
    });

    // #endregion

    // #region 悬浮球显示/隐藏

    let ballVisible = true,
        hideBallStyle = document.createElement("style");
    hideBallStyle.textContent = `.gameSetingButton {
        display: none !important;
    }`;
    /**
     * 切换悬浮球的可见性
     * @param {boolean|null} show - 是否显示悬浮球
     */
    const toggleBallVisible = (show = null) => {
        try {
            document.head[
                (ballVisible = show ?? !ballVisible)
                    ? "removeChild"
                    : "appendChild"
            ](hideBallStyle);
        } catch (e) {}
    };

    window.__autoGamer.toggleBallVisible = toggleBallVisible;
    toggleBallVisible();

    // #endregion

    // #region Alt+鼠标事件转发为触摸事件、indicator 快捷键、其他鼠标键盘事件处理

    // Alt+鼠标事件转发为 puppeteer 触摸事件
    let mouseLeftPressed = false;
    let dragStart = {
        x: 0,
        y: 0,
    };
    let dragConfirmed = false;
    let mousedownTime = 0;
    window.addEventListener("keydown", e => {
        if (e.repeat) return;
        if (e.key === "Alt") {
            altPressed = true;
            updateIndicator();
            showIndicator();
            indicator.style.setProperty("background", "#66ccff", "important");
            indicator.style.setProperty("color", "#000", "important");

            e.preventDefault();
            e.stopPropagation();
        }
        if (e.key === "h" && e.altKey) {
            updateIndicator(
                null,
                null,
                "",
                `<br>
Alt + h       显示帮助<br>
Alt + b       隐藏/显示悬浮球<br>
Alt + o       隐藏/显示遮罩<br>
Alt + x       开启/关闭触摸点十字线（默认开，首次触摸结束后显示）<br>
Alt + c       开启/关闭复制代码到剪贴板（默认关）<br>
Alt + m       人工干预后继续（仅干预期间生效）<br>
Alt + 鼠标左键 模拟 tap/drag/hold`,
            );
        }
        if (e.key === "b" && e.altKey) {
            toggleBallVisible();
        }
        if (e.key === "o" && e.altKey) {
            alwaysHideOverlay = !alwaysHideOverlay;
            overlay.style.setProperty(
                "display",
                alwaysHideOverlay ? "none" : "block",
                "important",
            );
        }
        if (e.key === "c" && e.altKey) {
            clipboardEnabled = !clipboardEnabled;
            updateIndicator();
            showIndicator();
        }
        if (e.key === "x" && e.altKey) {
            crosshairEnabled = !crosshairEnabled;
            updateCrosshairVisibility();
        }
    });
    window.addEventListener("keyup", e => {
        if (e.key === "Alt") {
            altPressed = false;
            updateIndicator();
            showIndicator();
            mouseLeftPressed = false;
            dragStart = {
                x: 0,
                y: 0,
            };
            dragConfirmed = false;
            mousedownTime = 0;
            indicator.style.setProperty(
                "background",
                "rgb(0,0,0)",
                "important",
            );
            indicator.style.setProperty("color", "#fff", "important");
        }
        if (e.key === "h" || !e.altKey) {
            updateIndicator(null, null, "", " ");
            e.preventDefault();
        }
    });

    window.addEventListener(
        "touchstart",
        e => {
            if (altPressed) {
                e.preventDefault();
                e.stopPropagation();
            }
        },
        {
            passive: false,
        },
    );
    window.addEventListener(
        "touchmove",
        e => {
            if (altPressed) {
                e.preventDefault();
                e.stopPropagation();
            }
        },
        {
            passive: false,
        },
    );
    window.addEventListener(
        "touchend",
        e => {
            if (altPressed) {
                e.preventDefault();
                e.stopPropagation();
            }
        },
        {
            passive: false,
        },
    );
    window.addEventListener(
        "mousedown",
        e => {
            console.log("mousedown", e);
            if (altPressed && e.button === 0) {
                e.preventDefault();
                mouseLeftPressed = true;
                dragStart = { x: e.clientX, y: e.clientY };
                mousedownTime = Date.now();
                dragConfirmed = false;
            }
        },
        true,
    );
    window.addEventListener(
        "mousemove",
        e => {
            if (altPressed && mouseLeftPressed) {
                const dx = Math.abs(e.clientX - dragStart.x);
                const dy = Math.abs(e.clientY - dragStart.y);
                if (dx >= 5 || dy >= 5) {
                    dragConfirmed = true;
                }
            }
        },
        true,
    );
    window.addEventListener(
        "mouseup",
        e => {
            console.log(mouseLeftPressed, e);
            if (!mouseLeftPressed) return;
            mouseLeftPressed = false;

            if (altPressed && e.button === 0) {
                e.preventDefault();
                const duration = Date.now() - mousedownTime;
                let cmd = "";

                if (dragConfirmed) {
                    // 移动距离超阈值，无论如何都触发 drag
                    window.postMessage(
                        {
                            type: "auto-gamer-mouse-to-drag",
                            from: { x: dragStart.x, y: dragStart.y },
                            to: { x: e.clientX, y: e.clientY },
                            duration,
                        },
                        "*",
                    );
                    cmd = `await action("", [["drag", ${dragStart.x}, ${dragStart.y}, ${e.clientX}, ${e.clientY}, ${duration}], ["sleep", 3000]]);`;
                } else if (duration >= 300) {
                    // 未移动且持续时间 >= 300ms，触发 hold
                    window.postMessage(
                        {
                            type: "auto-gamer-mouse-to-hold",
                            x: e.clientX,
                            y: e.clientY,
                            duration,
                        },
                        "*",
                    );
                    cmd = `await action("", [["hold", ${e.clientX}, ${e.clientY}, ${duration}], ["sleep", 3000]]);`;
                } else {
                    // 未移动且持续时间 < 300ms，触发 tap
                    window.postMessage(
                        {
                            type: "auto-gamer-mouse-to-tap",
                            x: e.clientX,
                            y: e.clientY,
                        },
                        "*",
                    );
                    cmd = `await action("", [["tt", ${e.clientX}, ${e.clientY}], ["sleep", 3000]]);`;
                }

                if (clipboardEnabled) {
                    navigator.clipboard.writeText(cmd).catch(() => {});
                }
                dragStart = {
                    x: 0,
                    y: 0,
                };
            }
        },
        true,
    );

    // #endregion

    // #region 消息监听

    window.addEventListener("message", e => {
        if (e.data?.type === "auto-gamer-log" && e.data.content) {
            updateIndicator(null, null, ` [log: ${e.data.content}]`, "");
        }
    });

    // #endregion

    // #region 标题与图标修改

    // 移除标题，替换图标
    if (!alwaysHideOverlay) {
        /** @type {HTMLLinkElement} */
        const link =
            document.querySelector("link[rel*='icon']") ||
            document.createElement("link");
        link.rel = "icon";
        link.href =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
        document.head.appendChild(link);
        setInterval(() => {
            document.title = ".";
        }, 3000);
    }

    // #endregion

    // #region 隐藏特定元素

    /** @type {string[]} */
    const selectors = [
        ".toastCommon", // 升画质提示
        ".top-control", // 时长提示
    ];
    /** @type {HTMLStyleElement} */
    const style = document.createElement("style");
    style.textContent = selectors
        .map(s => `${s} { display: none !important; }`)
        .join("\n");
    document.head.appendChild(style);

    // #endregion

    // #region 警告音播放

    /**
     * 播放警告音
     */
    const playWarningSound = () => {
        if (!window.__autoGamer) return;
        // 创建或复用 AudioContext（兼容写法）

        if (!window.__autoGamer.warningAudioCtx) {
            window.__autoGamer.warningAudioCtx = new window.AudioContext();
        }

        const ctx = window.__autoGamer.warningAudioCtx;

        // 如果浏览器自动暂停了音频上下文，恢复它
        if (ctx.state === "suspended") {
            ctx.resume();
        }

        const now = ctx.currentTime;

        // 播放三声急促警告音
        for (let i = 0; i < 3; i++) {
            const startTime = now + i * 0.15; // 每声间隔 0.15 秒

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            // 方波 + 1200Hz 高频，听起来很有紧迫感
            osc.type = "square";
            osc.frequency.setValueAtTime(1200, startTime);

            // 音量设置并快速淡出，避免爆音
            gain.gain.setValueAtTime(0.3, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.08);
        }
    };

    window.__autoGamer.playWarningSound = playWarningSound;

    // #endregion

    // #region 人工干预功能

    /**
     * 请求人工干预
     *
     * 行为：
     *  - 立即通过指示器显示 msg 与操作说明，并启动倒计时
     *  - 倒计时期间每秒更新剩余时间，并调用 playWarningSound()
     *  - 监听到 touchstart 后，取消倒计时，切换提示为"按 Alt+M 继续"
     *  - 倒计时结束 / 用户按下 Alt+M -> 兑现 promise，并清理监听
     *
     * Node.js 端通过 page.evaluate 调用并 await 返回的 Promise
     *
     * @param {string} [msg=""] 干预说明
     * @param {number} [timeout=15000] 超时毫秒
     * @returns {Promise<boolean>} 用户按 Alt+M 手动结束时返回 true，超时返回 false
     */
    window.__autoGamer.requestManualIntervention = (
        msg = "",
        timeout = 15000,
    ) => {
        return new Promise(resolve => {
            let resolved = false;
            /** @type {number | undefined} */
            let interval = undefined;
            let touched = false;
            let remaining = timeout;

            const cleanup = () => {
                if (interval !== undefined) {
                    window.clearInterval(interval);
                    interval = undefined;
                }
                window.removeEventListener(
                    "touchstart",
                    onTouchStartOrMouseDown,
                    true,
                );
                window.removeEventListener("keydown", onKeyDown, true);
                miActive = false;
                // 传 " " 以覆盖并清空旧的 extraHtml（updateIndicator 仅在 extraHtml truthy 时覆盖）
                updateIndicator(null, null, "", " ");
                showIndicator();
            };

            const finish = /** @param {boolean} value */ value => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve(value);
            };

            const renderMiHtml = (/** @type {string} */ extraMsg) =>
                `<br>${msg}<br><span style="color: red;">${extraMsg}</span><br>如不需要人工干预功能，请编辑脚本配置`;

            const onTouchStartOrMouseDown = () => {
                if (resolved || touched) return;
                touched = true;
                showIndicator();
            };

            const onKeyDown = /** @param {KeyboardEvent} e */ e => {
                if (resolved) return;
                if (e.key === "m" && e.altKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    finish(true);
                }
            };

            window.addEventListener("mousedown", onTouchStartOrMouseDown, true);
            window.addEventListener(
                "touchstart",
                onTouchStartOrMouseDown,
                true,
            );
            window.addEventListener("keydown", onKeyDown, true);

            miActive = true;
            updateIndicator(
                null,
                null,
                " [人工干预中]",
                renderMiHtml(
                    `Alt+鼠标左键进行操作，完成后按 Alt+M 继续 (剩余 ${Math.ceil(
                        remaining / 1000,
                    )}s，执行操作以停止计时)`,
                ),
            );
            showIndicator();

            interval = window.setInterval(() => {
                if (remaining <= 0) {
                    finish(false);
                    return;
                }

                playWarningSound();

                if (touched) {
                    updateIndicator(
                        null,
                        null,
                        " [人工干预中]",
                        renderMiHtml(
                            `Alt+鼠标左键进行操作，完成后<span style="color: #39c5bb;">按 Alt+M 继续</span> (已停止计时，请尽快操作)`,
                        ),
                    );
                    showIndicator();
                } else {
                    remaining -= 1000;
                    updateIndicator(
                        null,
                        null,
                        " [人工干预中]",
                        renderMiHtml(
                            `(剩余 ${Math.ceil(
                                remaining / 1000,
                            )}s，<span style="color: #39c5bb;">执行操作以停止计时</span>) Alt+鼠标左键进行操作，完成后按 Alt+M 继续`,
                        ),
                    );
                    showIndicator();
                }
            }, 1000);
        });
    };

    // #endregion

    // #region 缩放相关

    let configWidth = autoGamerConfig.viewport?.width ?? window.innerWidth,
        configHeight = autoGamerConfig.viewport?.height ?? window.innerHeight;
    window.addEventListener("resize", () => {
        if (!window.__autoGamer) return;
        window.__autoGamer.setScale?.(window.innerWidth, window.innerHeight);
    });
    /**
     * 计算缩放比例后的坐标，其结果不建议跨函数传递
     * @param {number | null} x x 坐标
     * @param {number | null} y y 坐标
     * @returns {{x: number, y: number}} 缩放比例后的坐标
     * */
    function posWithScale(x, y) {
        return {
            x: Math.round(Number(x) * (configWidth / window.innerWidth)),
            y: Math.round(Number(y) * (configHeight / window.innerHeight)),
        };
    }

    // 屏蔽浏览器原生缩放快捷键（Ctrl+滚轮 / Ctrl++ / Ctrl+-），
    // 避免页面缩放破坏 posWithScale 的坐标换算比例
    window.addEventListener(
        "wheel",
        e => {
            if (e.ctrlKey) e.preventDefault();
        },
        { passive: false },
    );
    window.addEventListener("keydown", e => {
        if (
            e.ctrlKey &&
            (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_")
        ) {
            e.preventDefault();
        }
    });

    // #endregion
};

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", window.__autoGamer.mainFn);
} else {
    window.__autoGamer.mainFn();
}
