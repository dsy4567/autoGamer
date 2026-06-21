const puppeteer = require("puppeteer-core");
const readline = require("readline");
const path = require("path");
const fs = require("fs");
const os = require("os");
const config = require("./config.js");
const { createUtils } = require("./utils.js");

// 日志增强钩子，初始为空函数，后续赋值以启用写文件/截屏
let _logWriteFile = () => {};
let _logScreenshot = () => {};

// 日志工具（只定义一次，通过钩子变量控制增强行为）
const log = (...args) => {
    const now = new Date().toISOString();
    console.log(`[${now}]`, ...args);
    _logWriteFile(now, args);
    _logScreenshot(args);
};
// 原始日志，不触发截图钩子，供截图函数自身使用以避免递归
const logRaw = (...args) => {
    const now = new Date().toISOString();
    console.log(`[${now}]`, ...args);
    _logWriteFile(now, args);
};

// 全局错误处理：捕获未捕获的异常和未处理的 Promise 拒绝
let _errorLogFile = null;

process.on("uncaughtException", err => {
    // 例外：允许使用 console.error 而不是 log/logRaw
    console.error("ERROR: 未捕获的异常:", err);
    if (_errorLogFile) {
        try {
            fs.appendFileSync(
                _errorLogFile,
                `[${new Date().toISOString()}] ERROR: 未捕获的异常: ${err.stack || err}\n`,
            );
        } catch (e) {}
    }
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    // 例外：允许使用 console.error 而不是 log/logRaw
    console.error("ERROR: 未处理的 Promise 拒绝:", reason);
    if (_errorLogFile) {
        try {
            fs.appendFileSync(
                _errorLogFile,
                `[${new Date().toISOString()}] ERROR: 未处理的 Promise 拒绝: ${reason?.stack || reason}\n`,
            );
        } catch (e) {}
    }
    process.exit(1);
});
/**
 * 设置日志截图钩子
 * @param {(label: string) => Promise<void>} screenshot 截图函数，参数为截图标签
 */
function setupLogScreenshot(screenshot) {
    // 根据配置决定是否启用日志事件截图
    // 截图函数内部已使用 logRaw 避免递归，此处无需额外过滤
    if (config.screenshots?.screenshotOnLog !== false) {
        _logScreenshot = args => {
            const label = args
                .map(a =>
                    typeof a === "object" ? JSON.stringify(a) : String(a),
                )
                .join(" ");
            screenshot(label)
                .then(() => logRaw("截图成功", label))
                .catch(() => {});
        };
    }
}
// 默认本地 Chrome 浏览器路径（如需 Edge/Chromium 请修改此处）
// function getLocalChromePath() {
//     const platform = os.platform();
//     if (platform === "win32") {
//         // Windows
//         return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
//     } else if (platform === "linux") {
//         // Linux
//         return "/usr/bin/google-chrome";
//     } else {
//         // 其他平台暂不支持
//         log("当前平台暂未配置默认浏览器路径，请手动指定");
//         return null;
//     }
// }
async function inject(/** @type {puppeteer.Page} */ page) {
    const injectPath = path.resolve(__dirname, "inject.js");
    if (fs.existsSync(injectPath)) {
        try {
            await page.mainFrame().addScriptTag({ path: injectPath });
            log("已注入 inject.js");
        } catch (e) {
            log("ERROR: inject.js 注入失败:", e.message);
        }
    } else {
        log("ERROR: inject.js 文件不存在，未注入");
    }
}

const MOBILE_UA =
    "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";

async function main() {
    const arg = process.argv[2];
    if (!arg) {
        log(
            "用法: node index.js login [登录URL] 或 node index.js test-page 或 node index.js <操作脚本.js>",
        );
        process.exit(1);
    }

    // 推导脚本名，用于日志目录
    const scriptName = (() => {
        if (!arg || arg === "login" || arg === "test-page") return "unknown";
        const ext = path.extname(arg);
        if (ext) return path.basename(arg, ext);
        return "unknown";
    })();
    const startTimeStr = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_");
    const logDir = config.isDev
        ? ""
        : path.resolve(__dirname, "logs", scriptName, startTimeStr);
    if (!config.isDev) {
        fs.mkdirSync(logDir, { recursive: true });
        const logFilePath = path.join(logDir, "log.txt");

        // 启用日志写入文件
        _errorLogFile = logFilePath;
        _logWriteFile = (now, args) => {
            try {
                fs.appendFileSync(
                    logFilePath,
                    `[${now}] ${args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}\n`,
                );
            } catch (e) {}
        };
    }

    // 获取本地浏览器路径
    // const executablePath = getLocalChromePath();
    // if (!executablePath || !fs.existsSync(executablePath)) {
    //     log("未找到本地浏览器，请检查路径:", executablePath);
    //     process.exit(1);
    // }
    // log("使用本地浏览器:", executablePath);

    // 启动 Puppeteer
    log("启动浏览器...");
    const userDataDir = path.resolve(
        __dirname,
        config.dirs?.userDataDirName || "user-data",
    );
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: {
            ...(config.viewport || {
                width: 640,
                height: 480,
                hasTouch: true,
                isLandscape: true,
            }),
        },
        channel: "chrome",
        userDataDir,
        args: config.puppeteerArgs || [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--mute-audio",
            "--disable-session-crashed-bubble",
            "--disable-gpu",
            "--use-gl=swiftshader",
            "--disable-gpu-compositing",
        ],
    });
    browser.on("disconnected", () => {
        log("所有浏览器窗口已关闭，程序退出");
        process.exit(0);
    });
    const [page] = await browser.pages();
    await page.setUserAgent(config.mobileUA || MOBILE_UA);
    log("已设置移动端UA");
    const pageOpenTime = Date.now();

    page.on("load", () => {
        log(
            "网页完全加载，用时:",
            Date.now() - pageOpenTime,
            "毫秒",
            page.url(),
        );
    });

    const {
        ts,
        te,
        tm,
        tt,
        pc,
        hold,
        sleep,
        drag,
        screenshot,
        startAutoScreenshot,
    } = createUtils({
        puppeteer,
        browser,
        page,
        log,
        logRaw,
        pageOpenTime,
        logDir,
    });

    // 监听页面 postMessage 事件，自动模拟 tap/drag
    await page.exposeFunction("__autoGamerSimulateTouch", async msg => {
        if (!msg || typeof msg !== "object" || !msg.type) return;
        if (msg.type === "auto-gamer-mouse-to-tap") {
            log("收到 tap 事件，位置:", msg.x, msg.y);
            try {
                await tt(msg.x, msg.y);
            } catch (e) {
                log("ERROR: tap 执行失败:", e.message);
            }
        } else if (msg.type === "auto-gamer-mouse-to-drag") {
            log("收到 drag 事件，从:", msg.from, "到:", msg.to);
            try {
                await drag(msg.from.x, msg.from.y, msg.to.x, msg.to.y);
            } catch (e) {
                log("ERROR: drag 执行失败:", e.message);
            }
        }
    });
    await page.evaluateOnNewDocument(() => {
        window.addEventListener("message", ev => {
            if (
                ev &&
                ev.data &&
                (ev.data.type === "auto-gamer-mouse-to-tap" ||
                    ev.data.type === "auto-gamer-mouse-to-drag")
            ) {
                // 通过 puppeteer 暴露的函数转发到 Node 端
                window.__autoGamerSimulateTouch(ev.data);
            }
        });
    });
    // 实时测试 REPL
    async function startRepl() {
        log(
            "进入实时测试模式，可输入并执行 puppeteer 代码 (用 browser, page, puppeteer, log 等变量)",
        );
        log("输入 exit 退出 REPL");

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: "> ",
        });
        rl.prompt();
        rl.on("line", async input => {
            if (input.trim() === "exit") {
                rl.close();
                return;
            }
            if (input.trim() === "") {
                log("网页已打开毫秒数:", Date.now() - pageOpenTime);
                return;
            }
            try {
                // 别名定义
                const ts = (x, y) => page.touchscreen.touchStart(x, y);
                const te = () => page.touchscreen.touchEnd();
                const tm = (x, y) => page.touchscreen.touchMove(x, y);
                const tt = (x, y) => page.touchscreen.tap(x, y);
                const pc = (...args) => page.click(...args);
                const tshe = async (x, y, hold = 100) => {
                    await ts(x, y);
                    await sleep(hold);
                    await te();
                };
                const sleep = ms => new Promise(r => setTimeout(r, ms));

                // 允许访问 browser, page, puppeteer, log 及别名
                // 例外：允许使用 console.error 而不是 log/logRaw
                const result = await eval(
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
    }

    if (arg === "login") {
        // 支持 node index.js login [url]
        let loginUrl =
            config.defaultLoginUrl || "https://www.migufun.com/middleh5/";
        // 允许 node index.js login https://xxx
        const url = process.argv.at(-1);
        try {
            loginUrl = new URL(url).toString();
        } catch (e) {
            log("WARNING: 未指定/无效的 URL，使用配置或默认登录页");
        }
        log(`打开登录页面: ${loginUrl}`);
        await page.goto(loginUrl, config.pageloadOptions);
        await inject(page);
        log("请在浏览器中完成登录操作，完成后关闭页面即可退出");

        // 每次跳转后自动注入
        page.on("framenavigated", async () => {
            await inject(page);
            setupLogScreenshot(screenshot);
        });
        await startRepl();
    } else {
        // 执行操作脚本
        let scriptPath = path.resolve(arg);
        if (!fs.existsSync(scriptPath)) {
            log("ERROR: 找不到操作脚本:", scriptPath);
            process.exit(1);
        }
        log("加载操作脚本:", scriptPath);
        // 传递 puppeteer, browser, page, log 给脚本
        const script = require(scriptPath);
        if (typeof script !== "function") {
            log("ERROR: 脚本文件需导出一个 async function");
            process.exit(1);
        }
        try {
            page.on("load", async () => {
                await inject(page);
                setupLogScreenshot(screenshot);
            });

            await script({
                puppeteer,
                browser,
                page,
                log,
                logRaw,
                pageOpenTime,
                logDir,
            });
        } catch (e) {
            log("ERROR: 脚本执行出错:", e);
        }
        // 每次跳转后自动注入
        page.on("framenavigated", async () => {
            await inject(page);
            setupLogScreenshot(screenshot);
        });
    }
}

main();
