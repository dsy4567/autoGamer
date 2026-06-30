const scriptConfig = require("./config/sr.config.default.js");
const { actionsInCloudGameBallAndExit, miguInit } = require("./share/migu.js");
const config = require("../config.default.js");

/**
 * @param {{
 *   puppeteer: typeof import("puppeteer-core"),
 *   browser: import("puppeteer-core").Browser,
 *   page: import("puppeteer-core").Page,
 *   log: (...args: any[]) => void,
 *   logRaw: (...args: any[]) => void,
 *   pageOpenTime: number,
 *   logDir: string
 * }} ctx
 */
module.exports = async function (ctx) {
    const { puppeteer, browser, page, log, logRaw, pageOpenTime, logDir } = ctx;
    const { createUtils } = require("../utils.js");
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
        action,
    } = createUtils(ctx, code => eval(code));

    // 领取简单奖励
    async function receiveSimpleRewards() {
        log("-----领取简单奖励-----");
        await action("进入每日实训", [
            ["tt", 495, 20],
            ["sleep", 3000],
        ]);

        await action("领取登录游戏活跃度", [
            ["tt", 108, 344],
            ["sleep", 3000],
        ]);

        await action("进入派遣页面", [
            ["tt", 127, 351],
            ["sleep", 3000],
        ]);

        await action("点击一键领取", [
            ["tt", 508, 378],
            ["sleep", 3000],
        ]);

        await action("点击空白处", [
            ["tt", 320, 342],
            ["sleep", 3000],
        ]);

        await action("关闭派遣页面", [
            ["tt", 609, 16],
            ["sleep", 3000],
        ]);

        await action("领取派遣活跃度", [
            ["tt", 110, 353],
            ["sleep", 3000],
        ]);

        await action("活跃度兑换奖励", [
            ["tt", 196, 155],
            ["sleep", 3000],
            ["tt", 196, 155],
            ["sleep", 3000],
        ]);

        await action("关闭每日实训页面", [
            ["tt", 612, 27],
            ["sleep", 3000],
        ]);
    }

    // 刷本
    async function dungeonFight() {
        log("-----刷本-----");
        await action("进入每日实训", [
            ["tt", 495, 20],
            ["sleep", 3000],
        ]);

        await action("进入生存索引", [
            ["tt", 133, 119],
            ["sleep", 3000],
        ]);

        {
            if (scriptConfig.dungeonType === 4) {
                await action("进入培养目标首个副本", [
                    ["tt", 533, 211],
                    ["sleep", 3000],
                ]);
            } else {
                await action("进入拟什么金", [
                    ["tt", 121, 261],
                    ["sleep", 3000],
                ]);
                switch (scriptConfig.dungeonType) {
                    case 1:
                        await action("进入经验书副本", [
                            ["tt", 539, 193],
                            ["sleep", 3000],
                        ]);
                        break;
                    case 2:
                        await action("进入武器矿副本", [
                            ["tt", 540, 242],
                            ["sleep", 3000],
                        ]);
                        break;
                    case 3:
                        await action("进入钞票副本", [
                            ["tt", 541, 295],
                            ["sleep", 3000],
                        ]);
                        break;
                    default:
                        log("WARNING: 未知副本类型，即将关闭指南页面");
                        await action("关闭指南页面", [
                            ["tt", 612, 28],
                            ["sleep", 3000],
                        ]);
                        return;
                }
            }

            await action("拉满挑战次数至24次", [
                ["tt", 563, 398],
                ["sleep", 3000],
            ]);

            await action("点击挑战按钮", [
                ["tt", 498, 436],
                ["sleep", 3000],
            ]);

            await action("选择1号队伍", [
                ["drag", 196, 31, 492, 31],
                ["sleep", 3000],
                ["drag", 196, 31, 492, 31],
                ["sleep", 3000],
                ["tt", 198, 29],
                ["sleep", 3000],
            ]);

            await action("开始挑战", [
                ["tt", 524, 435],
                ["sleep", scriptConfig.dungeonFightTime * 1000],
            ]);
        }

        await action("退出关卡", [
            ["tt", 215, 435],
            ["sleep", 10000],
        ]);

        await action("关闭副本页", [
            ["tt", 610, 29],
            ["sleep", 5000],
        ]);

        await action("重新进入每日实训", [
            ["tt", 495, 20],
            ["sleep", 5000],
        ]);

        await action("领取战斗活跃度", [
            ["tt", 110, 353],
            ["sleep", 3000],
            ["tt", 110, 353],
            ["sleep", 3000],
        ]);

        await action("活跃度兑换奖励", [
            ["tt", 377, 154],
            ["sleep", 3000],
            ["tt", 377, 154],
            ["sleep", 3000],
        ]);
    }

    async function main() {
        await sleep(scriptConfig.startupDelays.initialWait);

        await action("同意用户协议/点击开始游戏", [
            ["tt", 432, 281],
            ["sleep", scriptConfig.startupDelays.afterAgreement],
        ]);

        await action("点击开始游戏，等待读条", [
            ["tt", 300, 300],
            ["sleep", scriptConfig.startupDelays.afterStartGame],
        ]);

        await receiveSimpleRewards();
        await dungeonFight();

        await actionsInCloudGameBallAndExit(ctx);
    }

    log("游戏：崩坏：星穹铁道");
    log("等待页面加载");
    await page.goto(scriptConfig.gameUrl);

    // 根据配置决定是否启动自动定时截图
    if (config.screenshots?.autoScreenshotEnabled !== false) {
        startAutoScreenshot();
    }
    // 如果游戏已经启动，点击继续游戏
    await miguInit(ctx);

    if (!config.isDev) {
        setTaskTimeout(
            scriptConfig.taskTimeoutMs > 0
                ? scriptConfig.taskTimeoutMs
                : undefined,
        );
        await main();
    }

    // 自动化完成后即可进入 REPL
    startRepl();
};
