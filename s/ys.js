const readline = require("readline");

/**
 * @param {{
 *   puppeteer: typeof import("puppeteer-core"),
 *   browser: import("puppeteer-core").Browser,
 *   page: import("puppeteer-core").Page,
 *   log: (...args: any[]) => void,
 *   pageOpenTime: number
 * }} ctx
 */
module.exports = async function (ctx) {
    const { puppeteer, browser, page, log, pageOpenTime } = ctx;
    const { createUtils } = require("../utils.js");
    const { ts, te, tm, tt, pc, hold, sleep, drag } = createUtils(ctx);

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

    /** 在云游戏平台悬浮球内完成签到、退出 (WIP, do not use) */
    async function actionsInCloudGameAndExit() {
        log("开始签到");
        try {
            // 点击悬浮球元素
            await page.click(
                "#app > div > div.pagebox > div:nth-child(4) > div"
            );
            await sleep(3000);
            // 点击福利标签
            await page.click(
                "#app > div > div.pagebox > div.dialogBox.setingDialogBoxPanel.gameDirectX > div > div > div.leftbar > ul > li.item.welfare"
            );
            await sleep(3000);
            try {
                // first,scroll into view the sign button
                await page.evaluate(
                    'document.querySelector(".notSignInBtn").scrollIntoView()'
                );
                await sleep(1000);
                tt(488, 424);
            } catch (e) {
                log("今日已签到");
            }
            await sleep(7000);

            // exit
            await browser.close();
            process.exit(0);
        } catch (e) {
            log("签到失败", e);
        }
    }
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
    /** 传送到纳塔铁匠铺附近锚点 */
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

        await tt(432, 337);
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
        await hold(181, 343, 5500);
        await sleep(3000);

        await hold(181, 343, 5500);
        await sleep(3000);

        await tt(400, 240);
        await sleep(7000);

        await tt(300, 300);
        await sleep(2000);

        await tt(437, 275);
        await sleep(7000);

        await tt(300, 300);
        await sleep(5000);

        log(
            "选择魔晶矿-(点击锻造*4-点击锻造队列-点击领取-消除提示-点击配方)*3-点击关闭"
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
        await sleep(40000);
        log("点击开始游戏，等待卡岩");
        await tt(300, 300);
        await sleep(40000);

        // await goCraftingTable();
        await goBlacksmith();

        await goAdventurerGuild();

        await actionsInCloudGameAndExit();
    }

    log("游戏：原神");
    log("等待页面加载");
    // 原神启动
    await page.goto(
        "https://www.migufun.com/miguplay/middleGame/gameplay/400007864?gameName=%E5%8E%9F%E7%A5%9E%C2%B7%E7%A9%BA%E6%9C%88%E4%B9%8B%E6%AD%8C"
    );
    // 游戏已经启动，点击继续游戏
    setTimeout(async () => {
        try {
            await page.click("b.button.continueGame");
        } catch (e) {}
    }, 5000);

    await main();

    // 自动化完成后即可进入 REPL
    startRepl();
};
