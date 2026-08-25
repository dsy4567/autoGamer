process.env.PUPPETEER_SKIP_DOWNLOAD = "true";
const puppeteer = require("puppeteer-core");
const { log } = require("./logger.js");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const chromePath = {
    windows: [
        // chrome
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        // edge
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ],
    macos: [
        // chrome
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        // edge
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ],
    linux: [
        // chrome
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        // chromium
        "/usr/bin/chromium-browser",
        // edge
        "/usr/bin/microsoft-edge",
        "/usr/bin/microsoft-edge-stable",
    ],
    linux_flatpak: [
        // chrome
        "/var/lib/flatpak/exports/bin/com.google.Chrome",
        path.join(
            os.homedir(),
            ".local/share/flatpak/exports/bin/com.google.Chrome",
        ),
        // edge
        "/var/lib/flatpak/exports/bin/com.microsoft.Edge",
        path.join(
            os.homedir(),
            ".local/share/flatpak/exports/bin/com.microsoft.Edge",
        ),
    ],
    android: [
        // chromium
        "/data/data/com.termux/files/usr/bin/chromium-browser",
    ],
};

/**
 * 解析 Chrome 可执行文件路径
 *
 * 优先使用手动配置（config.chromeExecPath，path 不存在时直接报错），
 * 未配置时按操作系统在内置路径中自动查找；
 * Linux 下内置路径全部未命中时回退到 linux_flatpak 路径组
 *
 * @param {AutoGamer.GlobalConfig} config 配置对象
 * @returns {{ execPath: string, isFlatpak: boolean }} 可执行文件路径及是否为 flatpak 模式
 */
function resolveExecPath(config) {
    const platform = os.platform();
    const isLinux = platform === "linux";

    // 归一化手动配置（兼容旧版 string 格式，视为 { path }）
    /** @type {{ path: string, isFlatpak?: boolean } | null} */
    let manual = null;
    if (typeof config.chromeExecPath === "string") {
        manual = { path: config.chromeExecPath };
    } else if (
        config.chromeExecPath &&
        typeof config.chromeExecPath === "object" &&
        config.chromeExecPath.path
    ) {
        manual = {
            path: String(config.chromeExecPath.path),
            isFlatpak: Boolean(config.chromeExecPath.isFlatpak),
        };
    }

    if (manual) {
        if (!fs.existsSync(manual.path)) {
            throw new Error(
                `chromeExecPath.path 指向的文件不存在: ${manual.path}`,
            );
        }
        let isFlatpak = Boolean(manual.isFlatpak);
        if (isFlatpak && !isLinux) {
            log("WARNING: isFlatpak 仅在 Linux 下可用，已忽略该标志");
            isFlatpak = false;
        }
        log(`使用手动配置的浏览器路径: ${manual.path}`);
        return { execPath: manual.path, isFlatpak };
    }

    // 自动查找内置路径
    /** @type {"windows"|"macos"|"linux"|"android"|null} */
    const group =
        platform === "win32"
            ? "windows"
            : platform === "darwin"
              ? "macos"
              : platform === "linux"
                ? "linux"
                : platform === "android"
                  ? "android"
                  : null;
    if (!group) {
        throw new Error(`不支持的操作系统: ${platform}`);
    }
    for (const p of chromePath[group]) {
        if (fs.existsSync(p)) {
            log(`自动找到浏览器: ${p}`);
            return { execPath: p, isFlatpak: false };
        }
    }
    if (isLinux) {
        for (const p of chromePath.linux_flatpak) {
            if (fs.existsSync(p)) {
                log(`自动找到 flatpak 浏览器: ${p}`);
                return { execPath: p, isFlatpak: true };
            }
        }
    }
    throw new Error(
        "未找到可用的 Chrome/Edge 浏览器，请通过 globalConfig.js 配置 chromeExecPath",
    );
}

/**
 * flatpak 模式前置准备：确保用户数据目录可被 flatpak 应用读写
 *
 * 通过 `flatpak info --file-access` 检查访问级别，非 read-write 时
 * 尝试 `flatpak override` 添加读写权限（先 --user 后 --system），并复查结果
 *
 * @param {string} execPath 可执行文件路径（flatpak 导出脚本，文件名即应用 id）
 * @param {string} userDataDir Chrome 用户数据目录
 */
function prepareFlatpakAccess(execPath, userDataDir) {
    const pkgName = path.basename(execPath);
    // flatpak info 对不存在的路径可能异常，先确保目录存在
    fs.mkdirSync(userDataDir, { recursive: true });

    /**
     * 检查 flatpak 应用对目录的访问级别是否为 read-write
     * @returns {boolean}
     */
    const checkAccess = () => {
        try {
            const out = execSync(
                `flatpak info --file-access="${userDataDir}" ${pkgName}`,
                { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
            );
            return out.trim() === "read-write";
        } catch (e) {
            throw new Error(
                `flatpak info 检查权限失败（${pkgName} 可能未安装）: ${/** @type {any} */ (e)?.message || e}`,
            );
        }
    };

    if (checkAccess()) {
        log(`flatpak 应用 ${pkgName} 已有 ${userDataDir} 读写权限`);
        return;
    }

    log(`flatpak 应用 ${pkgName} 缺少 ${userDataDir} 读写权限，尝试添加...`);
    try {
        execSync(
            `flatpak override --user --filesystem="${userDataDir}":rw ${pkgName}`,
            { stdio: ["pipe", "pipe", "pipe"] },
        );
    } catch {
        log("ERROR: flatpak override 失败");
    }
    if (checkAccess()) {
        log(
            `已为 flatpak 应用 ${pkgName} 添加 ${userDataDir} 读写权限（--user）`,
        );
        return;
    }

    throw new Error(
        `无法为 flatpak 应用 ${pkgName} 添加 ${userDataDir} 读写权限，请手动执行: flatpak override --user --filesystem="${userDataDir}":rw ${pkgName}`,
    );
}

/**
 * 启动 Chrome 浏览器
 * @param {AutoGamer.GlobalConfig} config 配置对象
 * @returns {Promise<{ puppeteer: typeof import("puppeteer-core"), browser: import("puppeteer-core").Browser, execPath: string, isFlatpak: boolean }>}
 */
module.exports = async function (config) {
    try {
        const userDataDir =
            config.dirs?.chromeDataDir ??
            path.join(config.dataDir, "chromeData");

        const { execPath, isFlatpak } = resolveExecPath(config);
        if (isFlatpak) {
            prepareFlatpakAccess(execPath, userDataDir);
        }

        // 移除 Chrome Preferences 中的缩放偏好，避免页面缩放影响自动化操作
        {
            const preferencesPath = path.join(
                userDataDir,
                "Default",
                "Preferences",
            );
            if (fs.existsSync(preferencesPath)) {
                try {
                    const prefs = JSON.parse(
                        fs.readFileSync(preferencesPath, "utf-8"),
                    );
                    let modified = false;
                    // 移除每个主机的缩放级别
                    if (prefs.partition?.per_host_zoom_levels) {
                        prefs.partition.per_host_zoom_levels = {};
                        modified = true;
                    }
                    // 移除默认缩放级别
                    if (prefs.partition?.default_zoom_level !== undefined) {
                        prefs.partition.default_zoom_level = undefined;
                        modified = true;
                    }
                    if (modified) {
                        fs.writeFileSync(
                            preferencesPath,
                            JSON.stringify(prefs),
                            "utf-8",
                        );
                        log("已移除 Chrome Preferences 中的缩放偏好设置");
                    }
                } catch (e) {
                    log(
                        `WARNING: 处理 Preferences 文件失败: ${/** @type {any} */ (e)?.message || e}`,
                    );
                }
            }
        }

        let args = config.puppeteerArgs || [];
        if (config.mute) {
            args.push("--mute-audio");
        }

        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: config.viewport,
            executablePath: execPath,
            userDataDir,
            args,
        });
        return { puppeteer, browser, execPath, isFlatpak };
    } catch (e) {
        log(
            `ERROR: 启动 Chrome 浏览器失败: ${/** @type {any} */ (e)?.message || e}`,
        );
        throw e;
    }
};
