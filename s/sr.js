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
    const { ts, te, tm, tt, pc, hold, sleep, drag, startRepl } = createUtils(
        ctx,
        code => eval(code),
    );

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

    async function main() {
        log("等待星穹列车准备跃迁");
        await sleep(40000);

        log("点击开始游戏，等待读条");
        await tt(300, 300);
        await sleep(25000);

        log("进入每日实训");
        await tt(500, 20);

        log("领取登录游戏任务奖励");
        await tt(109, 351);

        log("进入派遣页面");
        await tt(109, 351);

        log("点击一键领取");
        await tt(97, 394);

        log("点击再次派遣");
        await tt(465, 422);

        log("关闭页面");
        await tt(611, 17);

        log("领取派遣任务奖励");
        await tt(109, 351);

        log("进入生存索引");
        await tt(109, 351);

        log("刷金币花");
        // await actionsInCloudGameAndExit();
    }

    log("游戏：崩坏：星穹铁道");
    log("等待页面加载");
    // 崩坏：星穹铁道启动
    await page.goto(
        "https://www.migufun.com/miguplay/middleGame/gameplay/400803874?gameName=%E5%B4%A9%E5%9D%8F%EF%BC%9A%E6%98%9F%E7%A9%B9%E9%93%81%E9%81%93"
    );
    // 游戏已经启动，点击继续游戏
    setTimeout(async () => {
        try {
            await page.click("b.button.continueGame");
        } catch (e) {}
    }, 5000);

    // await main();

    // 自动化完成后即可进入 REPL
    startRepl();
};
