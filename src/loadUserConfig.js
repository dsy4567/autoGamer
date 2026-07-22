/**
 * @fileoverview 加载用户自定义配置文件，不存在则自动创建空配置
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check
"use strict";

const fs = require("fs");
const path = require("path");

/**
 * 加载用户自定义配置文件，不存在则自动创建空配置
 * @param {string} userConfigPath 用户配置文件的绝对路径
 * @param {AutoGamer.LoadUserConfigCtx} ctx
 * @returns {object} 用户配置对象
 */
function loadUserConfig(userConfigPath, ctx) {
    if (!fs.existsSync(userConfigPath)) {
        fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
        fs.writeFileSync(
            userConfigPath,
            // TODO: 为其他脚本配置适配类型定义
            userConfigPath.endsWith("globalConfig.js")
                ? `// 全局用户自定义配置
// @ts-check
/// <reference path="./autoGamer.d.ts" />
/**
 * @type {Partial<AutoGamer.GlobalConfig>}
 * @see https://github.com/dsy4567/autoGamer/blob/main/config.default.js
 */
const config = {};
module.exports = config;
`
                : `// 脚本id ${ctx.scriptId} 的用户自定义配置，优先于 scripts/${ctx.scriptId}/config.default.js
// @ts-check
/**
 * @type {Partial<ReturnType<typeof import("../../scripts/${ctx.scriptId}/config.default.js")>>}
 * @see https://github.com/dsy4567/autoGamer/blob/main/userData.default/scripts/${ctx.scriptId}/config.default.js
 */
const config = {};
module.exports = config;
`,
        );
    }

    return require(userConfigPath);
}

module.exports = loadUserConfig;
