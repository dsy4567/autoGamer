const puppeteer = require("puppeteer-core");
const readline = require("readline");
const path = require("path");
const fs = require("fs");
const os = require("os");
const config = require("./config.js");

// 日志工具
function log(...args) {
    const now = new Date().toISOString();
    console.log(`[${now}]`, ...args);
}

// 默认本地 Chrome 浏览器路径（如需 Edge/Chromium 请修改此处）
function getLocalChromePath() {
    const platform = os.platform();
    if (platform === "win32") {
        // Windows
        return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    } else if (platform === "linux") {
        // Linux
        return "/usr/bin/google-chrome";
    } else {
        // 其他平台暂不支持
        log("当前平台暂未配置默认浏览器路径，请手动指定");
        return null;
    }
}
async function inject(/** @type {puppeteer.Page} */ page) {
    const injectPath = path.resolve(__dirname, "inject.js");
    if (fs.existsSync(injectPath)) {
        try {
            await page.mainFrame().addScriptTag({ path: injectPath });
            log("已注入 inject.js");
        } catch (e) {
            log("inject.js 注入失败:", e.message);
        }
    } else {
        log("inject.js 文件不存在，未注入");
    }
}

const MOBILE_UA =
    "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";

async function main() {
    const arg = process.argv[2];
    if (!arg) {
        log(
            "用法: node index.js login [登录URL] 或 node index.js test-page 或 node index.js <操作脚本.js>"
        );
        process.exit(1);
    }

    // 获取本地浏览器路径
    const executablePath = getLocalChromePath();
    if (!executablePath || !fs.existsSync(executablePath)) {
        log("未找到本地浏览器，请检查路径:", executablePath);
        process.exit(1);
    }
    log("使用本地浏览器:", executablePath);

    // 启动 Puppeteer
    log("启动浏览器...");
    const userDataDir = path.resolve(__dirname, "user-data");
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        executablePath,
        userDataDir,
        args: config.puppeteerArgs || [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--mute-audio",
        ],
    });
    browser.on("disconnected", () => {
        log("所有浏览器窗口已关闭，程序退出");
        process.exit(0);
    });
    const page = await browser.newPage();
    await page.setViewport({
        ...(config.viewport || {
            width: 640,
            height: 480,
            hasTouch: true,
            isLandscape: true,
        }),
    });
    await page.setUserAgent(config.mobileUA || MOBILE_UA);
    log("已设置移动端UA");
    const pageOpenTime = Date.now();

    page.on("load", () => {
        log(
            "网页完全加载，用时:",
            Date.now() - pageOpenTime,
            "毫秒",
            page.url()
        );
    });

    const { createUtils } = require("./utils.js");
    const { ts, te, tm, tt, pc, hold, sleep, drag } = createUtils({
        puppeteer,
        browser,
        page,
        log,
        pageOpenTime,
    });
    // 实时测试 REPL
    async function startRepl() {
        log(
            "进入实时测试模式，可输入并执行 puppeteer 代码 (用 browser, page, puppeteer, log 等变量)"
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
                const result = await eval(
                    `(async () => {try{${input}}catch(e){console.error(e)}})()`
                );
                log("执行结果:", result);
            } catch (e) {
                log("错误:", e);
            }
            rl.prompt();
        }).on("close", async () => {
            log("REPL结束，关闭浏览器...");
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
            log("未指定/无效的 URL，使用配置或默认登录页");
        }
        log(`打开登录页面: ${loginUrl}`);
        await page.goto(loginUrl);
        await inject(page);
        log("请在浏览器中完成登录操作，完成后关闭页面即可退出");

        // 每次跳转后自动注入
        page.on("framenavigated", async () => {
            await inject(page);
        });
        await startRepl();
    } else {
        // 执行操作脚本
        let scriptPath = path.resolve(arg);
        if (!fs.existsSync(scriptPath)) {
            log("找不到操作脚本:", scriptPath);
            process.exit(1);
        }
        log("加载操作脚本:", scriptPath);
        // 传递 puppeteer, browser, page, log 给脚本
        const script = require(scriptPath);
        if (typeof script !== "function") {
            log("脚本文件需导出一个 async function");
            process.exit(1);
        }
        try {
            page.on("load", async () => {
                await inject(page);
            });

            await script({ puppeteer, browser, page, log, pageOpenTime });
        } catch (e) {
            log("脚本执行出错:", e);
        }
        // 每次跳转后自动注入
        page.on("framenavigated", async () => {
            await inject(page);
        });
    }
}

main();
