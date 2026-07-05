// @ts-check

// ⚠️ 此文件在执行 init 或首次自动初始化时会被强制覆盖，请勿直接修改。
// 如需自定义脚本逻辑，请将整个 scripts/example/ 目录复制为新的 id（如 scripts/myExample/），并用新 id 运行：node index.js myExample
/// <reference path="../../autoGamer.d.ts" />
const loadScriptConfig = require("./config.default.js");

/**
 * @type {AutoGamer.ScriptFunction} ctx
 */
module.exports = async function (ctx) {
    const {
        puppeteer,
        browser,
        page,
        log,
        logRaw,
        pageOpenTime,
        logDir,
        getGlobalConfig,
        createUtils,
        loadUserConfig,
        dataDir,
        scriptId,
        startAtChain,
        endAtChain,
    } = ctx;
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
        startRepl,
        setTaskTimeout,
        compareScreenshot,
        action,
    } = createUtils(ctx, (/** @type {string} */ code) => eval(code));
    const config = getGlobalConfig();
    const scriptConfig = loadScriptConfig(ctx);

    async function main() {
        log("等待页面加载");
        await page.goto(
            "https://www.migufun.com/middleh5/newSignInPage",
            config.pageloadOptions,
        );

        await action("签到完成", [["sleep", 5000]]);
        await sleep(5000);

        await page.goto(
            "https://www.migufun.com/middleh5/cloudBeanZone",
            config.pageloadOptions,
        );

        await sleep(5000);
        const length = await page.evaluate(() => {
            /** @type {NodeListOf<HTMLDivElement>}  */
            const elements = document.querySelectorAll(".taskCard .finished");
            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                setTimeout(
                    () => {
                        element.click();
                    },
                    3000 * (i + 1),
                );
            }
            return elements.length;
        });

        await action("领取额外云豆完成", [["sleep", 5000 + length * 3000]]);

        log("签到完成，程序退出");
        process.exit(0);
    }

    log("咪咕自动签到+领云豆");

    // 根据配置决定是否启动自动定时截图
    if (config.screenshots?.autoScreenshotEnabled !== false) {
        startAutoScreenshot();
    }

    if (config.isDev) {
        log("Warning: 目前处于开发模式，请手动执行 main 函数");
    } else {
        setTaskTimeout(scriptConfig.taskTimeoutMs);
        await main();
    }
};
