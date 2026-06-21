const scriptConfig = require("./config/ys.config.js");
const {
    actionsInCloudGameBallAndExit,
    clickContinueGame,
} = require("./share/migu.js");
const config = require("../config.js");

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

    /** 重置角色位置到枫丹一个常用锚点 */
    async function resetPosition() {
        log("打开小地图");
        await tt(65, 52);
        await sleep(5000);

        log("右下角区域选择-选择枫丹地区");
        await tt(600, 450);
        await sleep(2000);
        await tt(434, 170);
        await sleep(2000);

        log("地图大致选点-选择传送锚点-点击传送");
        await tt(317, 243);
        await sleep(3000);

        await tt(454, 337);
        await sleep(3000);

        await tt(600, 444);

        log("等待传送完成");
        await sleep(15000);
    }
    /** 传送到纳塔铁匠铺附近口袋锚点 */
    async function teleportToNatlan() {
        log("打开小地图");
        await tt(65, 52);
        await sleep(5000);

        log("右下角区域选择-选择纳塔地区");
        await tt(600, 450);
        await sleep(2000);
        await tt(522, 170);
        await sleep(2000);

        log("地图大致选点-选择传送锚点-点击传送");
        await tt(302, 251);
        await sleep(3000);

        await tt(409, 399);
        await sleep(3000);

        await tt(600, 444);

        log("等待传送完成");
        await sleep(15000);
    }

    /** 通过前往合成台完成委托 */
    async function goCraftingTable() {
        await resetPosition();

        log("前往合成台-完成对话-点击合成");
        await hold(104, 312, 10000);
        await tt(390, 240);

        await sleep(7000);
        await tt(300, 300);

        log("选择浓缩-狂点减一-点击加一-点击合成-消除提示-点击关闭");
        await sleep(2000);
        await tt(70, 100);

        for (let i = 0; i < 4; i++) {
            await sleep(2000);
            await tt(343, 307);
        }
        await sleep(2000);

        await tt(570, 312);
        await sleep(2000);

        // return; // NOTE: for testing

        await tt(564, 454);
        await sleep(5000);

        await tt(609, 18);
        await sleep(2000);

        await tt(609, 18);
        await sleep(5000);
    }
    /** 通过前往纳塔铁匠铺完成委托 */
    async function goBlacksmith() {
        await teleportToNatlan();

        log("前往铁匠铺-完成对话-进入锻造页面");
        // await drag(300, 200, 400, 200);
        // await sleep(3000);

        // await hold(100, 320, 6500);
        // await sleep(3000);

        // await hold(151, 351, 250);
        // await sleep(3000);

        await tt(400, 240);
        await sleep(7000);

        await tt(300, 300);
        await sleep(2000);

        await tt(437, 275);
        await sleep(7000);

        await tt(300, 300);
        await sleep(5000);

        log(
            "选择魔晶矿-(点击锻造*4-点击锻造队列-点击领取-消除提示-点击配方)*3-点击关闭",
        );

        await tt(93, 181);
        await sleep(3000);

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 4; j++) {
                await tt(542, 453);
                await sleep(2000);
            }
            await sleep(3000);

            await tt(220, 60);
            await sleep(5000);

            await tt(65, 455);
            await sleep(5000);

            await tt(65, 455);
            await sleep(5000);

            await tt(75, 60);
            await sleep(5000);
        }
        await tt(600, 20);
        await sleep(5000);
    }
    /** 前往冒险家协会领取奖励 */
    async function goAdventurerGuild() {
        await resetPosition();

        log("前往凯瑟琳-打开手册-领取奖励-关闭提示-关闭手册");
        await hold(81, 346, 10000);

        await tt(530, 20);
        await sleep(5000);

        await tt(35, 153);
        await sleep(3000);

        await tt(560, 330);
        await sleep(5000);

        await tt(609, 100);
        await sleep(2000);

        await tt(609, 100);
        await sleep(5000);

        log("对话凯瑟琳-完成对话-选择派遣-领取全部奖励-再次派遣-关闭页面");
        await tt(396, 237);
        await sleep(7000);

        await tt(300, 300);
        await sleep(2000);

        await tt(439, 242);
        await sleep(5000);

        await tt(44, 450);
        await sleep(5000);

        await tt(406, 452);
        await sleep(5000);

        await tt(609, 18);
        await sleep(5000);

        log("对话凯瑟琳-完成对话-领取每日委托奖励-狂点");
        await tt(396, 237);
        await sleep(7000);

        await tt(300, 300);
        await sleep(2000);

        await tt(419, 176);
        await sleep(5000);

        for (let i = 0; i < 4; i++) {
            await tt(307, 78);
            await sleep(2000);
        }
    }
    async function main() {
        log("等待门出现");
        await sleep(scriptConfig.startupWaitMs);
        log("点击开始游戏，等待卡岩");
        await tt(300, 300);
        await sleep(scriptConfig.afterStartGameWaitMs);

        // await goCraftingTable();
        await goBlacksmith();

        await goAdventurerGuild();

        await actionsInCloudGameBallAndExit(ctx);
    }

    log("游戏：原神");
    log("等待页面加载");
    await page.goto(scriptConfig.gameUrl);

    // 根据配置决定是否启动自动定时截图
    if (config.screenshots?.autoScreenshotEnabled !== false) {
        startAutoScreenshot();
    }
    // 游戏已经启动，点击继续游戏
    clickContinueGame(page);

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
