// s/share/migu.js
// 咪咕快游云游戏平台通用操作集合
// 提供悬浮球签到、退出等跨脚本复用的功能

const { createUtils } = require("../../utils.js");

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
        await screenshot("签到完成");
        await sleep(4000);

        await browser.close();
        process.exit(0);
    } catch (e) {
        log("签到失败", e);
    }
}

module.exports = { actionsInCloudGameBallAndExit };
