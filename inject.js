// @ts-check

(() => {
    if (document.getElementById("auto-gamer-mouse-indicator")) return;

    let devMode = false;
    /** @type {{ alwaysHideOverlay: boolean }} */
    // @ts-ignore
    const autoGamerConfig = window.__autoGamerConfig || {};
    const alwaysHideOverlay = autoGamerConfig.alwaysHideOverlay || false;

    // 创建透明度为 0.01 的全屏遮罩
    const overlay = document.createElement("div");
    overlay.id = "auto-gamer-overlay";
    overlay.style.setProperty("position", "fixed", "important");
    overlay.style.setProperty("top", "0", "important");
    overlay.style.setProperty("left", "0", "important");
    overlay.style.setProperty("width", "100vw", "important");
    overlay.style.setProperty("height", "100vh", "important");
    overlay.style.setProperty("background", "rgba(0,0,0,0.99)", "important");
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
        if (devMode || alwaysHideOverlay) return;
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
        if (_extraContent) extraContent = _extraContent;
        indicator.textContent = `X: ${mousePos.x}, Y: ${mousePos.y}${
            altPressed ? " [Alt模式]" : " [Alt+H获取帮助]"
        }${extraContent}`;
        indicator.innerHTML += extraHtml;
    };
    const showIndicator = () => {
        indicator.style.setProperty("opacity", "0.8", "important");
        window.clearTimeout(setOpacityTimer);
        if (altPressed) return;
        setOpacityTimer = window.setTimeout(() => {
            indicator.style.setProperty("opacity", "0", "important");
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
            devMode = true;
        }
        if (e.key === "h" && e.altKey) {
            updateIndicator(
                null,
                null,
                "",
                `<br>
Alt + h       显示帮助<br>
Alt + b       隐藏/显示悬浮球<br>
Alt + 鼠标左键 模拟 tap/drag/hold，并复制代码到剪贴板`,
            );
            e.preventDefault();
            e.stopPropagation();
        }
        if (e.key === "b" && e.altKey) {
            toggleBallVisible();
            e.preventDefault();
            e.stopPropagation();
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

                navigator.clipboard.writeText(cmd).catch(() => {});
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

    // hook console.log
    // let originalLog = console.log;
    // console.log = function (...args) {
    //     originalLog.apply(console, args);
    // };
})();
