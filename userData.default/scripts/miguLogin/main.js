// ⚠️ 此文件在执行 init 或首次自动初始化时可能会被强制覆盖，请勿直接修改。
// 如需自定义脚本逻辑，请将整个 scripts/miguLogin/ 目录复制为新的 id（如 scripts/myMiguLogin/），在新目录修改并用新 id 运行

/**
 * @fileoverview 咪咕快游登录自动化脚本
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check
"use strict";

/// <reference path="../../autoGamer.d.ts" />

const { persistMiguCookies } = require("../../share/migu.js");

const loginUrl = "https://www.migufun.com/middleh5/";
const logoutUrl = "https://www.migufun.com/middleh5/ucenter";

/**
 * @type {AutoGamer.ScriptFunction}
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
        userDataDir,
        scriptId,
        startAtChain,
        endAtChain,
        getInstanceInfo,
        enableHotReload,
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
        compareScreenshot,
        action,
        mi,
        setBeforeUnload,
    } = createUtils(ctx, (/** @type {string} */ code) => eval(code));
    const config = getGlobalConfig();
    const scriptConfig = require("./config.default.js")(ctx);

    const isLogout = process.argv.includes("logout");

    if (isLogout) {
        // logout 模式：打开页面等待用户退出登录
        log("打开页面以清空登录状态");
        await page.goto(logoutUrl, config.pageloadOptions);
        log(">>>>>>>>>>请在浏览器中完成退出登录操作，完成后关闭页面<<<<<<<<<<");
        await startRepl();
    } else {
        // 监听页面加载事件，每次加载时执行 persistMiguCookies
        page.on("load", async () => {
            const url = page.url();
            if (url.includes("migufun.com")) {
                log("检测到咪咕页面加载，执行 cookie 持久化");
                await persistMiguCookies(ctx);
            }
        });

        // login 模式：打开页面等待用户登录
        log(`打开登录页面: ${loginUrl}`);
        await page.goto(loginUrl, config.pageloadOptions);
        setTimeout(() => {
            logRaw(
                ">>>>>>>>>>请在浏览器中完成登录操作，完成后关闭页面<<<<<<<<<<",
            );
        }, 3000);
        await startRepl();
    }
};
