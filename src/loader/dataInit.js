/**
 * @fileoverview 初始化数据
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check

"use strict";

const path = require("path");
const fs = require("fs");

const { log } = require("../logger.js");
const config = require("../config.default.js");

/**
 * 强制覆盖单个文件
 * @param {string} src
 * @param {string} dest
 */
function copyForce(src, dest) {
    fs.cpSync(src, dest, { force: true });
}

/**
 * 强制覆盖整个目录（递归合并覆盖，不删除目标中额外文件）
 * @param {string} src
 * @param {string} dest
 */
function copyDirForce(src, dest) {
    fs.cpSync(src, dest, { recursive: true, force: true });
}

/**
 * 递归收集目录下所有文件的元数据
 * @param {string} baseDir 用于计算相对路径的基准目录
 * @param {string} dir 要扫描的目录
 * @param {Record<string, AutoGamer.FileMetadata>} result
 */
function _collectFileMetadata(baseDir, dir, result) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            _collectFileMetadata(baseDir, fullPath, result);
        } else if (stat.isFile()) {
            const relPath = path
                .relative(baseDir, fullPath)
                .split(path.sep)
                .join("/");
            result[relPath] = { size: stat.size, mtimeMs: stat.mtimeMs };
        }
    }
}

/**
 * 获取指定脚本相关的源文件元数据快照
 * @param {string} sourceDir 项目内 userData.default 源目录
 * @param {string|null} scriptId 当前脚本 id（null 表示所有脚本）
 * @returns {AutoGamer.SourceMetadata}
 */
function getSourceMetadata(sourceDir, scriptId) {
    /** @type {Record<string, AutoGamer.FileMetadata>} */
    const files = {};

    for (const file of ["README.md", "autoGamer.d.ts"]) {
        const filePath = path.join(sourceDir, file);
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            files[file] = { size: stat.size, mtimeMs: stat.mtimeMs };
        }
    }

    const shareDir = path.join(sourceDir, "share");
    _collectFileMetadata(sourceDir, shareDir, files);

    const scriptsDir = path.join(sourceDir, "scripts");
    if (scriptId) {
        const scriptDir = path.join(scriptsDir, scriptId);
        _collectFileMetadata(sourceDir, scriptDir, files);
    } else if (fs.existsSync(scriptsDir)) {
        for (const id of fs.readdirSync(scriptsDir)) {
            const scriptDir = path.join(scriptsDir, id);
            if (fs.statSync(scriptDir).isDirectory()) {
                _collectFileMetadata(sourceDir, scriptDir, files);
            }
        }
    }

    return { files };
}

/**
 * 读取已存储的源文件元数据
 * @param {string} userDataDir 数据目录
 * @returns {AutoGamer.SourceMetadata | null}
 */
function _readStoredSourceMetadata(userDataDir) {
    const metadataPath = path.join(userDataDir, "sourceMetadata.json");
    if (!fs.existsSync(metadataPath)) return null;
    try {
        const content = fs.readFileSync(metadataPath, "utf-8");
        return JSON.parse(content);
    } catch (/** @type {any} */ e) {
        return null;
    }
}

/**
 * 写入源文件元数据快照
 * @param {string} userDataDir 数据目录
 * @param {AutoGamer.SourceMetadata} metadata
 */
function writeSourceMetadata(userDataDir, metadata) {
    const metadataPath = path.join(userDataDir, "sourceMetadata.json");
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 4), "utf-8");
}

/**
 * 同步指定脚本相关的全部源文件到数据目录（用于元数据记录损坏时的全量同步）
 * @param {string} sourceDir 项目内 userData.default 源目录
 * @param {string} userDataDir 数据目录
 * @param {string} scriptId 当前脚本 id
 */
function _syncScriptFiles(sourceDir, userDataDir, scriptId) {
    const dirs = ["share", path.join("scripts", scriptId)];
    const files = ["README.md", "autoGamer.d.ts"];
    for (const item of [...dirs, ...files]) {
        const src = path.join(sourceDir, item);
        const dest = path.join(userDataDir, item);
        if (!fs.existsSync(src)) continue;
        if (files.includes(item)) {
            copyForce(src, dest);
        } else {
            copyDirForce(src, dest);
        }
    }
}

/**
 * 启动时检查源文件元数据是否一致
 *
 * 行为由 config.autoSyncSourceFiles 控制（默认 true）：
 * - true：检测到不一致时自动把源文件同步到数据目录，并刷新元数据记录
 * - false：仅输出警告，提示用户手动执行 init <scriptId>
 *
 * @param {string} sourceDir 项目内 userData.default 源目录
 * @param {string} userDataDir 数据目录
 * @param {string} scriptId 当前脚本 id
 * @returns {boolean}
 */
function checkSourceMetadata(sourceDir, userDataDir, scriptId) {
    const current = getSourceMetadata(sourceDir, scriptId);
    const stored = _readStoredSourceMetadata(userDataDir);
    // 归一化配置：接受 true/1/"1"/"true" 等可转换值，避免 === 严格比较失败（见避坑指南 #3）
    const autoSync = Boolean(config.autoSyncSourceFiles);

    if (!stored || typeof stored.files !== "object") {
        if (autoSync) {
            log(
                "WARNING: 源文件元数据记录不存在或已损坏，已自动同步源文件并重新生成记录",
            );
            _syncScriptFiles(sourceDir, userDataDir, scriptId);
        } else {
            log(
                `WARNING: 源文件元数据记录不存在或已损坏，正在重新生成；如需同步文件请执行 init ${scriptId}`,
            );
        }
        writeSourceMetadata(userDataDir, current);
        return true;
    }

    // 仅检查当前脚本相关文件：stored 可以是超集（例如 init 未指定脚本 id 时记录了全量文件）
    const currentKeys = Object.keys(current.files).sort();

    if (autoSync) {
        // 自动同步模式：收集所有不一致文件并复制，最后统一刷新元数据
        /** @type {string[]} */
        const changedKeys = [];
        for (const key of currentKeys) {
            const cur = current.files[key];
            const sto = stored.files[key];
            if (!sto || cur.size !== sto.size || cur.mtimeMs !== sto.mtimeMs) {
                changedKeys.push(key);
            }
        }
        if (changedKeys.length > 0) {
            for (const key of changedKeys) {
                log(`WARNING: 源文件 ${key} 需要更新，已自动同步最新文件`);
                const src = path.join(sourceDir, key);
                const dest = path.join(userDataDir, key);
                if (fs.existsSync(src)) {
                    fs.mkdirSync(path.dirname(dest), { recursive: true });
                    copyForce(src, dest);
                }
            }
            writeSourceMetadata(userDataDir, current);
        }
        return true;
    }

    // 仅警告模式：检测到首个不一致即返回，提示用户手动执行 init
    for (const key of currentKeys) {
        const cur = current.files[key];
        const sto = stored.files[key];
        if (!sto || cur.size !== sto.size || cur.mtimeMs !== sto.mtimeMs) {
            log(
                `WARNING: 源文件 ${key} 需要更新，建议执行 init ${scriptId} 以同步最新文件`,
            );
            return false;
        }
    }

    return true;
}

/**
 * 执行 init 命令：创建数据目录、各脚本的 logs/scriptData 子目录，并强制覆盖相关文件
 * @param {string} sourceDir 项目内 userData.default 源目录
 * @param {string} userDataDir 数据目录
 * @param {string|null} [scriptId] 指定脚本 id（null 表示所有脚本）
 */
function runInit(sourceDir, userDataDir, scriptId = null) {
    fs.mkdirSync(userDataDir, { recursive: true });

    // 扫描源 scripts 目录，为相关脚本创建 logs/<id>/、scriptData/<id>/
    const scriptsSrc = path.join(sourceDir, "scripts");
    /** @type {string[]} */
    const ids = [];
    if (scriptId) {
        const scriptDir = path.join(scriptsSrc, scriptId);
        if (fs.existsSync(scriptDir) && fs.statSync(scriptDir).isDirectory()) {
            ids.push(scriptId);
        } else {
            log(`WARNING: 找不到脚本 ${scriptId}，跳过该脚本相关目录创建`);
        }
    } else if (fs.existsSync(scriptsSrc)) {
        ids.push(
            ...fs
                .readdirSync(scriptsSrc)
                .filter(id =>
                    fs.statSync(path.join(scriptsSrc, id)).isDirectory(),
                ),
        );
    }
    for (const id of ids) {
        ["logs", "scriptData"].forEach(dir => {
            fs.mkdirSync(path.join(userDataDir, dir, id), {
                recursive: true,
            });
        });
    }

    // 强制覆盖（源=目标时跳过，避免递归）
    if (path.resolve(sourceDir) !== path.resolve(userDataDir)) {
        const dirs = scriptId
            ? ["share", path.join("scripts", scriptId)]
            : ["share", "scripts"];
        const files = ["README.md", "autoGamer.d.ts"];
        const items = [...files, ...dirs];
        for (const item of items) {
            const src = path.join(sourceDir, item);
            const dest = path.join(userDataDir, item);
            if (!fs.existsSync(src)) continue;
            if (files.includes(item)) {
                copyForce(src, dest);
            } else {
                copyDirForce(src, dest);
            }
        }

        // 非开发模式记录源文件元数据快照
        if (config.isDev !== 1) {
            const metadata = getSourceMetadata(sourceDir, scriptId);
            writeSourceMetadata(userDataDir, metadata);
        }

        log("初始化完成:", userDataDir, scriptId || "");
    } else {
        log(
            "开发模式：数据目录与源目录相同，跳过复制，仅创建子目录:",
            userDataDir,
        );
    }
}

/**
 * 非开发模式自动初始化：数据目录不存在时创建并复制内置文件
 * @param {string} sourceDir 项目内 userData.default 源目录
 * @param {string} userDataDir 数据目录
 * @param {string|null} scriptId 当前脚本 id（login 时为 null）
 */
function ensureDataDir(sourceDir, userDataDir, scriptId) {
    if (config.isDev === 1) return;

    // 仅操作和特定脚本有关的目录和文件
    const dirs = [
        "share",
        ...(scriptId ? [path.join("scripts", scriptId)] : []),
    ];
    /** @type {string[]}  */
    const files = ["README.md", "autoGamer.d.ts"];
    const items = [...dirs, ...files];

    let initialized = false;
    if (items.some(item => !fs.existsSync(path.join(userDataDir, item)))) {
        log("WARNING: 相关目录不存在，正在初始化");
        fs.mkdirSync(userDataDir, { recursive: true });
        for (const item of items) {
            const src = path.join(sourceDir, item);
            const dest = path.join(userDataDir, item);
            if (!fs.existsSync(src)) continue;
            if (files.includes(item)) {
                copyForce(src, dest);
            } else {
                copyDirForce(src, dest);
            }
        }
        initialized = true;
        log("已初始化数据目录:", userDataDir);
    }

    // 为当前脚本创建 logs/<id>/、scriptData/<id>/
    if (scriptId) {
        ["logs", "scriptData"].forEach(dir => {
            fs.mkdirSync(path.join(userDataDir, dir, scriptId), {
                recursive: true,
            });
        });
    }

    // 首次自动初始化时记录源文件元数据快照
    if (initialized && scriptId) {
        const metadata = getSourceMetadata(sourceDir, scriptId);
        writeSourceMetadata(userDataDir, metadata);
    }
}

module.exports = {
    runInit,
    ensureDataDir,
    checkSourceMetadata,
};
