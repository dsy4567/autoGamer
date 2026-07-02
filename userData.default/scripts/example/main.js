// ⚠️ 此文件在执行 init 或首次自动初始化时会被强制覆盖，请勿直接修改。
// 如需自定义脚本逻辑，请将整个 scripts/example/ 目录复制为新的 id（如 scripts/myExample/），并用新 id 运行：node index.js myExample
const loadScriptConfig = require("./config.default.js");
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
 *   createUtils: () => ReturnType<typeof import("../../../utils.js").createUtils>,
 *   loadUserConfig: typeof import("../../../loadUserConfig.js"),
 *   dataDir: string,
 *   scriptId: string,
 *   startAtChain: string[] | null,
 *   endAtChain: string[] | null
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
    } = createUtils(ctx, code => eval(code));
    const config = getGlobalConfig();
    const scriptConfig = loadScriptConfig(ctx);

    async function main() {
        // ========== 你的自动化逻辑 ==========
    }

    await runGame(ctx, "原神（示例脚本）", scriptConfig, main, code =>
        eval(code),
    );
};
