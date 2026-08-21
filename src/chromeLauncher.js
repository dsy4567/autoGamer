const puppeteer = require("puppeteer-core");
const { log } = require("./logger.js");
const os = require("os");
const path = require("path");

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
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome-stable",
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
};

/**
 * 启动 Chrome 浏览器
 * @param {AutoGamer.GlobalConfig} config 配置对象
 * @param {string} userDataDir 用户数据目录
 * @returns {Promise<puppeteer.Browser>} 浏览器实例
 */
module.exports = async function (config, userDataDir) {
    try {
        let args = config.puppeteerArgs || [];
        if (config.mute) {
            args.push("--mute-audio");
        }

        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: config.viewport,
            ...(config.chromeExecPath
                ? { executablePath: config.chromeExecPath }
                : { channel: "chrome" }),
            userDataDir,
            args: config.puppeteerArgs,
        });
        return browser;
    } catch (e) {
        log(`启动 Chrome 浏览器失败: ${/** @type {any} */ (e)?.message || e}`);
        throw e;
    }
};
