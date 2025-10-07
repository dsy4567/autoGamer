(() => {
    if (document.getElementById("copilot-mouse-indicator")) return;

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
    indicator.id = "copilot-mouse-indicator";
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
        indicator.textContent = `X: ${e.clientX}, Y: ${e.clientY}`;
    });
    document.addEventListener("touchmove", function (e) {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            indicator.textContent = `X: ${touch.clientX}, Y: ${touch.clientY}`;
        }
    });

    // 透明 1x1 像素 GIF 的 Data URL，用于“清空”图标
    const BLANK_ICON =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    // 通过 rel 属性查找图标元素
    const $icon = document.querySelector('link[rel="shortcut icon"]');

    setInterval(() => {
        document.title = ".";
        if ($icon) $icon.href = BLANK_ICON;
    }, 3000);
})();
