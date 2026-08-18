// ⚠️ 此文件在执行 init 或首次自动初始化时可能会被强制覆盖，请勿直接修改。
// 如需自定义脚本逻辑，请将 share/migu.js 复制为新的文件（如 share/myMigu.js）

/**
 * @fileoverview 咪咕快游云游戏平台通用操作集合
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check
"use strict";

/// <reference path="../../autoGamer.d.ts" />

/** 咪咕平台需要管理的 cookie 名称列表 */
const MIGU_COOKIE_NAMES = ["userToken", "userId", "deviceId", "cookieId"];

/**
 * 将 migufun.com 域下 userToken / userId / deviceId / cookieId 的有效期设为永久。
 * 基于 browserContext cookie API（cookies + setCookie），可处理 HttpOnly cookie。
 * @param {AutoGamer.ScriptCtx} ctx
 * @returns {Promise<void>}
 */
async function persistMiguCookies(ctx) {
    const { page, log } = ctx;
    if (!isMiguDomain(ctx)) {
        log(
            "WARNING: persistMiguCookies: 当前页面不在 migufun.com 域名下，已跳过设置 cookie",
        );
        return;
    }
    const context = page.browserContext();
    /** @type {import("puppeteer-core").Cookie[]} */
    const all = await context.cookies();
    // 仅保留 migufun.com 域下的目标 cookie
    const targets = all.filter(
        c =>
            MIGU_COOKIE_NAMES.includes(c.name) &&
            (c.domain === "migufun.com" || c.domain.endsWith(".migufun.com")),
    );
    if (!targets.length) {
        log(
            "WARNING: 未找到待设置的 cookie（userToken/userId/deviceId/cookieId）",
        );
        return;
    }
    // 永久有效期：unix 秒时间戳 4000000000，即 2096 年
    const expires = 4000000000;
    await context.setCookie(...targets.map(c => ({ ...c, expires })));
    // log(
    //     `已将以下 cookie 有效期设为永久: ${targets.map(c => c.name).join(", ")}`,
    // );
}

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
        await page.evaluate("window?.__autoGamer?.toggleBallVisible?.(true)");
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
        await persistMiguCookies(ctx);
        await browser.close();
        process.exit(0);
    }
}

/**
 * @param {AutoGamer.ScriptCtx} ctx
 * @param {string} gameUrl
 * @returns {Promise<void>}
 */
async function miguInit(ctx, gameUrl) {
    return new Promise(async (resolve, reject) => {
        if (!ctx || ctx.getInstanceInfo?.()?.isHotReload) return resolve();
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

        page.on("load", async () => {
            const U = new URL(page.url());
            if (
                !U.hostname.endsWith(".migufun.com") &&
                U.hostname !== "migufun.com"
            )
                return resolve();

            await sleep(5000);
            if (!config.isDev) {
                const errBtn =
                    (await page.$("div.dialogBox b.iknowGoback")) || // 平台维护
                    (await page.$("div.dialogBox b.quitToHome")) ||
                    (await page.$(".c-update-dialog")); // 游戏更新
                if (errBtn) {
                    const msg = await page.$eval(
                        "div.dialogBox div.dialogMsg",
                        el => el?.textContent.trim() || "",
                    );
                    throw new Error(
                        "检测到维护或其他公告，无法进入游戏：" + msg,
                    );
                }
            }

            try {
                await Promise.any([
                    page.click("b.button.continueGame"),
                    page.click("b.button.continueOpen"),
                ]);
                log("点击继续游戏按钮");
            } catch (e) {
                // log("似乎没有同时启动的游戏，已跳过点击继续游戏按钮");
            }
            await page.waitForSelector(".HMplayerBox");
            await sleep(5000);
            log("咪咕快游加载完成");
            resolve();

            await persistMiguCookies(ctx);
        });

        await page.goto(gameUrl, config.pageloadOptions);
    });
}

/**
 * 检查当前页面是否处于 migufun.com 域名下
 * @param {AutoGamer.ScriptCtx} ctx
 * @returns {boolean}
 */
function isMiguDomain(ctx) {
    const hostname = new URL(ctx.page.url()).hostname;
    return hostname === "migufun.com" || hostname.endsWith(".migufun.com");
}

module.exports = {
    actionsInCloudGameBallAndExit,
    miguInit,
    persistMiguCookies,
};
