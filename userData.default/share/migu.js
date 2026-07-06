// ⚠️ 此文件在执行 init 或首次自动初始化时可能会被强制覆盖，请勿直接修改。
// 如需自定义脚本逻辑，请将 share/migu.js 复制为新的文件（如 share/myMigu.js）

/**
 * @fileoverview 咪咕快游云游戏平台通用操作集合
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: MIT
 */

// @ts-check
"use strict";

/// <reference path="../../autoGamer.d.ts" />

/**
 * @param {AutoGamer.ScriptCtx} ctx
 */
async function actionsInCloudGameBallAndExit(ctx) {
    if (!ctx) return;
    const { browser, page, log, getGlobalConfig, createUtils } = ctx;
    const { tt, sleep, screenshot } = createUtils(ctx);
    const config = getGlobalConfig();

    log("开始签到");
    try {
        // 点击悬浮球元素
        await page.click("#app > div > div.pagebox > div:nth-child(4) > div");
        await sleep(3000);
        try {
            // 点击福利标签
            await page.click(
                "#app > div > div.pagebox > div.dialogBox.setingDialogBoxPanel.gameDirectX > div > div > div.leftbar > ul > li.item.welfare",
            );
            await sleep(3000);
            // 先将签到按钮滚动到可视区域
            await page.evaluate(
                'document.querySelector(".notSignInBtn").scrollIntoView()',
            );
            await sleep(1000);
            // 点击签到按钮
            tt(488, 424);
        } catch (e) {
            log("今日已签到");
        }
        await sleep(3000);
        if (config.isDev) await screenshot("签到完成");
        await sleep(7000);

        await page.evaluate(
            'document.querySelector(".quitCont .quit-icon").click()',
        );
        await sleep(1000);
        await page.evaluate('document.querySelector(".sureQuitGame").click()');
        await sleep(5000);
    } catch (e) {
        log("ERROR: 签到失败", e);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

/**
 * @param {AutoGamer.ScriptCtx} ctx
 */
async function miguInit(ctx) {
    if (!ctx) return;
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
        startRepl,
        drag,
        setTaskTimeout,
        screenshot,
        startAutoScreenshot,
    } = createUtils(ctx);
    const config = getGlobalConfig();

    // TODO: 云游戏连接成功后再继续
    await (async () => {
        await sleep(5000);
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
            // log("点击继续游戏按钮成功");
        } catch (e) {
            // log("似乎没有同时启动的游戏，已跳过点击继续游戏按钮");
        }
        // await page.waitForSelector(".gameSetingButton");
    })();
}

module.exports = { actionsInCloudGameBallAndExit, miguInit };
