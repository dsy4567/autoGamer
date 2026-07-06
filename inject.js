/**
 * @fileoverview 注入增强功能到游戏页面
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check
"use strict";

(window => {
    if (document.getElementById("auto-gamer-mouse-indicator")) return;

    // @ts-ignore
    window.__autoGamer = window.__autoGamer || {};
    /** @type {{ alwaysHideOverlay: boolean }} */
    // @ts-ignore
    const autoGamerConfig = window.__autoGamer.config || {};
    let alwaysHideOverlay = autoGamerConfig.alwaysHideOverlay || false;

    // 创建透明度为 0.01 的全屏遮罩
    const overlay = document.createElement("div");
    overlay.id = "auto-gamer-overlay";
    overlay.style.setProperty("position", "fixed", "important");
    overlay.style.setProperty("top", "0", "important");
    overlay.style.setProperty("left", "0", "important");
    overlay.style.setProperty("width", "100vw", "important");
    overlay.style.setProperty("height", "100vh", "important");
    overlay.style.setProperty("background", "rgba(0,0,0,0.999)", "important");
    overlay.style.setProperty("z-index", "1000001", "important");
    overlay.style.setProperty("pointer-events", "none", "important");
    if (alwaysHideOverlay) {
        overlay.style.setProperty("display", "none", "important");
    }
    document.body.appendChild(overlay);

    // 鼠标移入遮罩时隐藏它
    document.documentElement.addEventListener("mouseenter", function () {
        overlay.style.setProperty("display", "none", "important");
    });

    // 鼠标离开遮罩时重新显示
    document.documentElement.addEventListener("mouseleave", function () {
        if (alwaysHideOverlay) return;
        overlay.style.setProperty("display", "block", "important");
    });

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

    // 创建一个显示坐标的指示器元素
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
    indicator.textContent = "X: 0, Y: 0";
    document.documentElement.appendChild(indicator);

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
                _extraContent.substring(0, 50) +
                (_extraContent.length > 50 ? "..." : "");
        // 鼠标距页面顶部 <= 50px 时，指示器靠下显示，避免遮挡
        if (mousePos.y <= 64) {
            indicator.style.setProperty("top", "auto", "important");
            indicator.style.setProperty("bottom", "10px", "important");
        } else {
            indicator.style.setProperty("bottom", "auto", "important");
            indicator.style.setProperty("top", "10px", "important");
        }
        indicator.textContent = `X: ${mousePos.x}, Y: ${mousePos.y}${
            altPressed ? " [Alt模式]" : " [Alt+H获取帮助]"
        }${clipboardEnabled ? " [剪贴板开]" : ""}${extraContent}`;
        indicator.innerHTML += extraHtml;
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

    // 隐藏/显示悬浮球
    let ballVisible = true,
        hideBallStyle = document.createElement("style");
    hideBallStyle.textContent = `.gameSetingButton {
        display: none !important;
    }`;
    const toggleBallVisible = () => {
        try {
            document.head[
                (ballVisible = !ballVisible) ? "removeChild" : "appendChild"
            ](hideBallStyle);
        } catch (e) {}
    };
    toggleBallVisible();

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
            indicator.style.setProperty(
                "background",
                "rgb(255,100,0)",
                "important",
            );

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

    window.addEventListener("message", e => {
        if (e.data?.type === "auto-gamer-log" && e.data.content) {
            updateIndicator(null, null, ` [log: ${e.data.content}]`, "");
        }
    });

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

    // 隐藏指定元素
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

    /**
     * 播放警告音
     */
    const playWarningSound = () => {
        // 创建或复用 AudioContext（兼容写法）
        // @ts-ignore
        if (!window._warningAudioCtx) {
            // @ts-ignore
            window._warningAudioCtx = new // @ts-ignore
            (window.AudioContext || window.webkitAudioContext)();
        }
        // @ts-ignore
        const ctx = window._warningAudioCtx;

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
    // @ts-ignore
    window.__autoGamer.playWarningSound = playWarningSound;

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
    // @ts-ignore
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
                // 传 " " 以覆盖并清空旧的 extraHtml（updateIndicator 仅在 truthy 时覆盖）
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
                remaining -= 1000;

                if (remaining <= 0) {
                    finish(false);
                    return;
                }

                playWarningSound();

                if (touched) {
                    clearInterval(interval);
                    updateIndicator(
                        null,
                        null,
                        " [人工干预中]",
                        renderMiHtml(
                            `Alt+鼠标左键进行操作，完成后按 Alt+M 继续 (已停止计时，请尽快操作)`,
                        ),
                    );
                    showIndicator();
                } else {
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
                }
            }, 1000);
        });
    };

    // hook console.log
    // let originalLog = console.log;
    // console.log = function (...args) {
    //     originalLog.apply(console, args);
    // };
})(window);
