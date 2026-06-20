const scriptConfig = require("./config/sr.config.js");
const { actionsInCloudGameBallAndExit } = require("./share/migu.js");

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
    } = createUtils(ctx, code => eval(code));

    // 领取简单奖励
    async function receiveSimpleRewards() {
        log("进入每日实训");
        await tt(495, 20);
        await sleep(3000);

        log("领取登录游戏活跃度");
        await tt(108, 344);
        await sleep(3000);

        log("进入派遣页面");
        await tt(127, 351);
        await sleep(3000);

        log("点击一键领取");
        await tt(508, 378);
        await sleep(3000);

        log("点击空白处");
        await tt(320, 342);
        await sleep(3000);

        log("关闭派遣页面");
        await tt(609, 16);
        await sleep(3000);

        log("领取派遣活跃度");
        await tt(110, 353);
        await sleep(3000);

        log("活跃度兑换奖励");
        await tt(196, 155);
        await sleep(3000);
        await tt(196, 155);
        await sleep(3000);

        log("关闭每日实训页面");
        await tt(612, 27);
        await sleep(3000);
    }

    // 刷本
    async function dungeonFight() {
        log("进入每日实训");
        await tt(495, 20);
        await sleep(3000);

        log("进入生存索引");
        await tt(133, 119);
        await sleep(3000);

        log("进入拟什么金");
        await tt(121, 261);
        await sleep(3000);

        {
            switch (scriptConfig.dungeonType) {
                case 1:
                    log("进入经验书副本");
                    await tt(539, 193);
                    await sleep(3000);
                    break;
                case 2:
                    log("进入武器矿副本");
                    await tt(540, 242);
                    await sleep(3000);
                    break;
                case 3:
                    log("进入钞票副本");
                    await tt(541, 295);
                    await sleep(3000);
                    break;
            }

            log("拉满挑战次数至24次");
            await tt(563, 398);
            await sleep(3000);

            log("点击挑战按钮");
            await tt(498, 436);
            await sleep(3000);

            log("选择1号队伍");
            await drag(196, 31, 492, 31);
            await sleep(3000);
            await drag(196, 31, 492, 31);
            await sleep(3000);
            await tt(198, 29);
            await sleep(3000);

            log("开始挑战");
            await tt(524, 435);
            await sleep(scriptConfig.dungeonFightTime * 1000);
        }

        log("退出关卡");
        await tt(215, 435);
        await sleep(10000);

        log("关闭副本页");
        await tt(610, 29);
        await sleep(5000);

        log("重新进入每日实训");
        await tt(495, 20);
        await sleep(5000);

        log("领取战斗活跃度");
        await tt(110, 353);
        await sleep(3000);
        await tt(110, 353);
        await sleep(3000);

        log("活跃度兑换奖励");
        await tt(377, 154);
        await sleep(3000);
        await tt(377, 154);
        await sleep(3000);
    }

    async function main() {
        setTaskTimeout(scriptConfig.taskTimeoutMs);

        await sleep(scriptConfig.startupDelays.initialWait);

        log("同意用户协议/点击开始游戏");
        await tt(432, 281);
        await sleep(scriptConfig.startupDelays.afterAgreement);

        log("点击开始游戏，等待读条");
        await tt(300, 300);
        await sleep(scriptConfig.startupDelays.afterStartGame);

        await receiveSimpleRewards();
        await dungeonFight();

        await actionsInCloudGameBallAndExit({ page, browser, log, sleep, tt });
    }

    log("游戏：崩坏：星穹铁道");
    log("等待页面加载");
    // 崩坏：星穹铁道启动
    await page.goto(scriptConfig.gameUrl);
    // 如果游戏已经启动，点击继续游戏
    setTimeout(async () => {
        try {
            await page.click("b.button.continueGame");
        } catch (e) {}
    }, 5000);

    // await main();

    // 自动化完成后即可进入 REPL
    startRepl();
};
