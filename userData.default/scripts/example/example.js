const scriptConfig = require("./example.config.default.js");
const { runGame } = require("../../share/gameRunner.js");

/**
 * @param {{
 *   puppeteer: typeof import("puppeteer-core"),
 *   browser: import("puppeteer-core").Browser,
 *   page: import("puppeteer-core").Page,
 *   log: (...args: any[]) => void,
 *   logRaw: (...args: any[]) => void,
 *   pageOpenTime: number,
 *   logDir: string,
 *   getGlobalConfig: () => typeof import("../../../config.default.js"),
 *   createUtils: () => typeof import("../../../utils.js").createUtils
 * }} ctx
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
    } = createUtils(ctx, code => eval(code));
    const config = getGlobalConfig();

    async function main() {
        // ========== 你的自动化逻辑 ==========
    }

    await runGame(ctx, "原神（示例脚本）", scriptConfig, main, code =>
        eval(code),
    );
};
