(() => {
    if (document.getElementById("auto-gamer-mouse-indicator")) return;

    let devMode = false;
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
    window.addEventListener = new Proxy(window.addEventListener, {
        apply(target, thisArg, args) {
            // 屏蔽 visibilitychange/pagehide/pageshow 事件监听
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
    indicator.style.setProperty("opacity", "0.5", "important");
    indicator.style.setProperty("padding", "6px 12px", "important");
    indicator.style.setProperty("background", "rgba(0,0,0,0.7)", "important");
    indicator.style.setProperty("color", "#fff", "important");
    indicator.style.setProperty("border-radius", "6px", "important");
    indicator.style.setProperty("font-size", "14px", "important");
    indicator.style.setProperty("z-index", "9999", "important");
    indicator.style.setProperty("pointer-events", "none", "important");
    indicator.textContent = "X: 0, Y: 0";
    document.documentElement.appendChild(indicator);

    // 鼠标移动时更新坐标
    document.addEventListener("mousemove", function (e) {
        indicator.textContent = `X: ${e.clientX}, Y: ${e.clientY}${
            shiftPressed ? " [Shift模式]" : ""
        }`;
    });
    document.addEventListener("touchmove", function (e) {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            indicator.textContent = `X: ${touch.clientX}, Y: ${touch.clientY}${
                shiftPressed ? " [Shift模式]" : ""
            }`;
        }
    });

    // Shift+鼠标事件转发为 puppeteer 触摸事件
    let shiftPressed = false;
    let dragStart = null;
    let dragOngoing = false;
    window.addEventListener("keydown", e => {
        if (e.key === "Shift") {
            shiftPressed = true;
            indicator.style.setProperty(
                "background",
                "rgba(255,100,0,0.7)",
                "important"
            );
            devMode = true;
        }
    });
    window.addEventListener("keyup", e => {
        if (e.key === "Shift") {
            shiftPressed = false;
            indicator.style.setProperty(
                "background",
                "rgba(0,0,0,0.7)",
                "important"
            );
        }
    });

    // click/tap
    window.addEventListener(
        "mousedown",
        e => {
            if (shiftPressed && e.button === 0) {
                dragStart = { x: e.clientX, y: e.clientY };
                dragOngoing = true;
            }
        },
        true
    );
    window.addEventListener(
        "mouseup",
        e => {
            if (shiftPressed && e.button === 0 && dragOngoing) {
                dragOngoing = false;
                // 判断是否为 click
                const dx = Math.abs(e.clientX - dragStart.x);
                const dy = Math.abs(e.clientY - dragStart.y);
                let cmd = "";
                if (dx < 5 && dy < 5) {
                    // click->tap
                    window.postMessage(
                        {
                            type: "auto-gamer-mouse-to-tap",
                            x: e.clientX,
                            y: e.clientY,
                        },
                        "*"
                    );
                    cmd = `await tt(${e.clientX}, ${e.clientY});
await sleep(3000)
`;
                } else {
                    // drag->drag
                    window.postMessage(
                        {
                            type: "auto-gamer-mouse-to-drag",
                            from: dragStart,
                            to: { x: e.clientX, y: e.clientY },
                        },
                        "*"
                    );
                    cmd = `await drag(${dragStart.x}, ${dragStart.y}, ${e.clientX}, ${e.clientY});
await sleep(3000)
`;
                }
                navigator.clipboard.writeText(cmd);
            }
        },
        true
    );

    // 透明 1x1 像素 GIF 的 Data URL，用于"清空"图标
    const BLANK_ICON =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    // 通过 rel 属性查找图标元素
    const $icon = document.querySelector('link[rel="shortcut icon"]');

    setInterval(() => {
        document.title = ".";
        if ($icon) $icon.href = BLANK_ICON;
    }, 3000);
})();
