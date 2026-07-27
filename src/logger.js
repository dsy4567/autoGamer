/**
 * @fileoverview 日志记录器
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check
"use strict";

const fs = require("fs");
const { styleText: _styleText } = require("util");
const styleText = _styleText || ((_, text) => text);

const loggerHooks = {
    /** 日志增强钩子，初始为空函数，后续赋值以启用写文件 @type {(now: string, str: string) => void} */
    _logWriteFile: () => {},
    /** 日志增强钩子，初始为空函数，后续赋值在网页展示日志 @type {(str: string) => void} */
    _logWriteHtml: () => {},
};

/**
 * 解析日志参数，识别级别并剥离前缀
 * @param {any[]} args
 * @returns {{ level: "INFO" | "WARNING" | "ERROR", color: "green" | "yellow" | "red", args: any[] }}
 */
function _parseLogArgs(args) {
    /** @type {"INFO" | "WARNING" | "ERROR"} */
    let level = "INFO";
    /** @type {"green" | "yellow" | "red"} */
    let color = "green";
    const first = args[0];
    if (typeof first === "string") {
        if (/^ERROR[:：]/.test(first)) {
            level = "ERROR";
            color = "red";
        } else if (/^WARNING[:：]/.test(first)) {
            level = "WARNING";
            color = "yellow";
        }
        if (level !== "INFO") {
            const rest = first.replace(/^(ERROR|WARNING)[:：]\s?/, "");
            if (rest === "" && args.length === 1) {
                args = [];
            } else {
                args = [rest, ...args.slice(1)];
            }
        }
    }
    return { level, color, args };
}

// 日志工具（只定义一次，通过钩子变量控制增强行为）
/** 输出日志并触发写文件钩子 @param {...any} args */
function log(...args) {
    const now = new Date().toISOString();
    const { level, color, args: processedArgs } = _parseLogArgs(args);
    const tag = `[${level}]`;
    const coloredTag = styleText(color, tag);
    const consoleMethod =
        level === "ERROR" ? "error" : level === "WARNING" ? "warn" : "log";
    const str = [tag, ...processedArgs]
        .map(a => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");
    console[consoleMethod](`[${now}]`, coloredTag, ...processedArgs);
    loggerHooks._logWriteFile(now, str);
    loggerHooks._logWriteHtml(str);
}

/** 原始日志，不触发截图钩子，供截图函数自身使用以避免递归 @param {...any} args */
function logRaw(...args) {
    const now = new Date().toISOString();
    const { level, color, args: processedArgs } = _parseLogArgs(args);
    const tag = `[${level}]`;
    const coloredTag = styleText(color, tag);
    const consoleMethod =
        level === "ERROR" ? "error" : level === "WARNING" ? "warn" : "log";
    const str = [tag, ...processedArgs]
        .map(a => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");
    console[consoleMethod](`[${now}]`, coloredTag, ...processedArgs);
    loggerHooks._logWriteFile(now, str);
    loggerHooks._logWriteHtml(str);
}

// 退出时输出警告消息
function _printExitWarnings() {
    if (exitWarnings && exitWarnings.length > 0) {
        for (const warning of exitWarnings) {
            log("WARNING:", warning);
        }
    }
}
/** 错误日志文件路径，记录未捕获的异常和未处理的 Promise 拒绝 @type {string | null} */
let _errorLogFile = null;

/** 退出时要输出的警告消息 @type {string[] | null} */
const exitWarnings = [];
/** 未捕获异常处理函数 @type {((...args: any[]) => any)[]} */
const onUncaughtException = [];

process.on("uncaughtException", async err => {
    // 例外：允许使用 console.error 而不是 log/logRaw
    console.error("[ERROR] 未捕获的异常:", err);
    if (_errorLogFile) {
        try {
            fs.appendFileSync(
                _errorLogFile,
                `[${new Date().toISOString()}] [ERROR] 未捕获的异常: ${err.stack || err}\n`,
            );
        } catch (e) {}
    }
    // 调用所有未捕获异常处理函数
    for (const handler of onUncaughtException) {
        await handler();
    }
    process.exit(1);
});

process.on("unhandledRejection", async (reason, promise) => {
    // 例外：允许使用 console.error 而不是 log/logRaw
    console.error("[ERROR] 未处理的 Promise 拒绝:", reason);
    if (_errorLogFile) {
        try {
            fs.appendFileSync(
                _errorLogFile,
                // @ts-ignore
                `[${new Date().toISOString()}] [ERROR] 未处理的 Promise 拒绝: ${reason?.stack || reason}\n`,
            );
        } catch (e) {}
    }
    // 调用所有未处理 Promise 拒绝处理函数
    for (const handler of onUncaughtException) {
        await handler();
    }
    process.exit(1);
});

process.on("exit", _printExitWarnings);

module.exports = {
    log,
    logRaw,
    loggerHooks,
    setErrorLogFilePath: /** @param {string | null} value */ value =>
        (_errorLogFile = value),
    exitWarnings,
    onUncaughtException,
};
