// s/share/migu.js
// 咪咕快游云游戏平台通用操作集合
// 提供悬浮球签到、退出等跨脚本复用的功能

const { createUtils } = require("../../utils.js");
const config = require("../../config.default.js");

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
async function actionsInCloudGameBallAndExit(ctx) {
    const { puppeteer, browser, page, log, logRaw, pageOpenTime, logDir } = ctx;

    const {
        ts,
        te,
        tm,
        tt,
        pc,
        hold,
        sleep,
        startRepl,
        drag,
        setTaskTimeout,
        screenshot,
        startAutoScreenshot,
    } = createUtils(ctx);

    log("开始签到");
    try {
        // 点击悬浮球元素
        await page.click("#app > div > div.pagebox > div:nth-child(4) > div");
        await sleep(3000);
        // 点击福利标签
        await page.click(
            "#app > div > div.pagebox > div.dialogBox.setingDialogBoxPanel.gameDirectX > div > div > div.leftbar > ul > li.item.welfare",
        );
        await sleep(3000);
        try {
            // 先将签到按钮滚动到可视区域
            await page.evaluate(
                'document.querySelector(".notSignInBtn").scrollIntoView()',
            );
            await sleep(1000);
            tt(488, 424);
        } catch (e) {
            log("今日已签到");
        }
        await sleep(3000);
        if (config.isDev) await screenshot("签到完成");
        await sleep(4000);

        await browser.close();
        process.exit(0);
    } catch (e) {
        log("ERROR: 签到失败", e);
    }
}

/**
 * 游戏已启动时，点击继续游戏按钮；检查是否有维护等公告
 * @param {import("puppeteer-core").Page} page
 */
function clickContinueGame(page) {
    setTimeout(async () => {
        if (!config.isDev) {
            const errBtn =
                (await page.$("div.dialogBox b.iknowGoback")) ||
                (await page.$("div.dialogBox b.quitToHome"));
            if (errBtn) {
                const msg = await page.$eval(
                    "div.dialogBox div.dialogMsg",
                    el => el?.textContent.trim() || "",
                );
                throw new Error("检测到维护或其他公告，无法进入游戏：" + msg);
            }
        }
        try {
            await Promise.any([
                page.click("b.button.continueGame"),
                page.click("b.button.continueOpen"),
            ]);
            // TODO: ~~console.log是不符合规范的写法，等待重构后改正~~ 一段时间后删除注释
            // console.log("点击继续游戏按钮成功");
        } catch (e) {
            // console.log("似乎没有同时启动的游戏，已跳过点击继续游戏按钮");
        }
    }, 5000);
}

module.exports = { actionsInCloudGameBallAndExit, clickContinueGame };
