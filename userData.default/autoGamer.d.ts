// ⚠️ 此文件在执行 init 或首次自动初始化时可能会被强制覆盖，请勿直接修改。
// 如需自定义脚本逻辑，请将整个 share/gameRunner.js 复制为新的 id（如 share/myGameRunner.js），在新目录修改

/**
 * @fileoverview
 * autoGamer 项目核心类型声明
 *
 * 此文件为项目核心文件（utils.js / index.js / config.default.js / loadUserConfig.js）
 * 以及 userData.default/ 下的脚本提供编辑器补全和类型检查。
 *
 * 消费方式：
 *   - 项目核心文件：自动被 jsconfig.json include，类型全局可用
 *   - userData.default/ 下的脚本：在文件顶部添加三斜杠指令
 *       /// <reference path="../autoGamer.d.ts" />
 *     或相对路径调整后即可使用全局命名空间 AutoGamer 下的类型
 *
 * 注意：本文件不导出 userData.default/ 下脚本的类型，那些脚本继续使用 JSDoc。
 * @author dsy4567
 * @license
 * Copyright (c) 2025~2026 dsy4567
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// @ts-check

import type {
    Browser,
    Page,
    GoToOptions,
    TouchHandle,
    Viewport,
} from "puppeteer-core";

type SimulateTouch = (msg: {
    type:
        | "auto-gamer-mouse-to-tap"
        | "auto-gamer-mouse-to-drag"
        | "auto-gamer-mouse-to-hold"
        | "auto-gamer-log";
    x?: number;
    y?: number;
    from?: { x: number; y: number };
    to?: { x: number; y: number };
    duration?: number;
    content?: string;
}) => Promise<void>;

declare global {
    namespace AutoGamer {
        // ============ Operation 相关类型 ============

        /**
         * 单个操作元组
         * - ["ts", x, y]            触摸开始
         * - ["te"]                  触摸结束
         * - ["tm", x, y]            触摸移动
         * - ["tt", x, y]            触摸点击
         * - ["pc", selector]        页面点击
         * - ["hold", x, y, dur?]    长按（dur 默认 1000ms）
         * - ["drag", fx, fy, tx, ty, dur?]  拖拽（dur 默认 500ms）
         * - ["sleep", ms]           延时
         * - ["fn", fn, args]        自定义函数，fn(desc, ctx, ...args) 通过 await 执行，不处理抛错
         * - ["mi", msg, ms]         请求人工干预，ms 为超时毫秒，默认 15000
         * - ["setBeforeUnload", enabled?] 设置关闭网页前是否二次确认（enabled 默认 true）
         * - ["cs", pngPath, options?, onMatch?, onError?]  截图比对，匹配成功执行 onMatch，比对出错执行 onError，匹配失败仅警告
         */
        type Operation =
            | ["ts", number, number]
            | ["te"]
            | ["tm", number, number]
            | ["tt", number, number]
            | ["pc", string]
            | ["hold", number, number, number?]
            | ["drag", number, number, number, number, number?]
            | ["sleep", number]
            | [
                  "fn",
                  (
                      desc: string,
                      ctx: ScriptCtx | UtilsCtx,
                      ...args: any[]
                  ) => any,
                  any[],
              ]
            | [
                  "fn",
                  (
                      desc: string,
                      ctx: ScriptCtx | UtilsCtx,
                      ...args: any[]
                  ) => any,
              ]
            | ["mi", string?, number?]
            | ["setBeforeUnload", boolean?]
            | [
                  "cs",
                  string,
                  CompareScreenshotOptions?,
                  OperationArray?,
                  OperationArray?,
              ];

        /** 操作数组 */
        type OperationArray = Operation[];

        // ============ action / screenshot 选项 ============

        /** action("waitSceneChange", ...) 的选项 */
        interface WaitSceneChangeOptions {
            /** 超时毫秒，默认 600000 */
            timeout?: number;
            /** 检查间隔毫秒，默认 3000，不少于 200 */
            interval?: number;
            /** 变化阈值，范围 [0, 1]，默认 0.9 */
            threshold?: number;
            /** 反向模式，默认 false。为 true 时画面无变化（相似度 ≥ threshold）则继续执行 */
            inverse?: boolean;
            /** 复查次数，默认 0。>=1 时，复查期间强制截图间隔为 3000ms，需连续多次复查通过后才继续执行 */
            recheckCount?: number;
            /** 截图区域，未提供时使用默认视口区域；提供时必须包含完整的 x, y, width, height 属性 */
            clip?: { x: number; y: number; width: number; height: number };
            /** 基准截图文件路径，指定后将使用该文件作为基准图，不再进行首次实时截图 */
            referenceFile?: string;
        }

        /** action 普通操作的选项 */
        interface ActionOptions {
            /** 是否在 action 完成后自动截图，默认 true */
            screenshot?: boolean;
        }

        /** screenshot 选项 */
        interface ScreenshotOptions {
            /** 为 true 时返回 Buffer 而非写入文件 */
            returnBuffer?: boolean;
            /** 截图区域，未提供时使用默认视口区域 */
            clip?: { x: number; y: number; width: number; height: number };
        }

        /** compareScreenshot 选项 */
        interface CompareScreenshotOptions {
            /** 相似度阈值，范围 [0, 1]，默认 0.9。截图与文件相似度 >= threshold 时返回 true */
            threshold?: number;
            /** 截图区域，未提供时使用默认视口区域；提供时必须包含完整的 x, y, width, height 属性 */
            clip?: { x: number; y: number; width: number; height: number };
            /** 复查次数，默认 0。>=1 时需连续多次复查通过后才返回 true */
            recheckCount?: number;
            /** 复查间隔毫秒，默认 3000，不少于 200 */
            recheckInterval?: number;
            /** 反向模式，默认 false。为 true 时相似度 < threshold 才视为满足条件 */
            inverse?: boolean;
        }

        // ============ createUtils / Utils ============

        /** 用于 REPL 中执行代码的 eval 函数 */
        type EvalFn = (code: string) => any;

        /** createUtils(ctx, _eval?) 返回的工具集 */
        interface Utils {
            /** 触摸开始 - 在指定坐标触发 touchStart 事件 */
            ts(x: number, y: number): Promise<TouchHandle>;
            /** 触摸结束 - 触发 touchEnd 事件 */
            te(): Promise<void>;
            /** 触摸移动 - 在指定坐标触发 touchMove 事件 */
            tm(x: number, y: number): Promise<void>;
            /** 触摸点击 - 在指定坐标触发 tap 事件 */
            tt(x: number, y: number): Promise<void>;
            /** 页面点击 - 调用 page.click(selector) */
            pc(selector: string): Promise<void>;
            /** 长按 - 在指定坐标按下并保持一段时间后释放（duration 默认 1000ms） */
            hold(x: number, y: number, duration?: number): Promise<void>;
            /** 拖拽 - 从起点拖拽到终点，分步模拟触摸移动（duration 默认 500ms） */
            drag(
                fromX: number,
                fromY: number,
                toX: number,
                toY: number,
                duration?: number,
            ): Promise<void>;
            /** 延时等待 */
            sleep(ms: number): Promise<void>;
            /**
             * 请求人工干预 - 在页面显示提示，等待用户触摸后按 Alt+M 继续，或超时自动继续
             * @param [msg=""] 干预说明
             * @param [timeout=15000] 超时毫秒
             * @returns 用户按 Alt+M 手动结束时返回 true，超时返回 false；调用失败时返回 false
             */
            mi(msg?: string, timeout?: number): Promise<boolean>;
            /** 启动定时自动截图（默认间隔 30000ms），返回停止定时器的函数 */
            startAutoScreenshot(interval?: number): () => void;
            /**
             * 比对当前页面截图与指定 PNG 文件的相似度
             *
             * 注意：当前页面截图与指定 PNG 文件的尺寸必须完全相同，否则会抛出异常
             * （截图尺寸由 config.viewport 决定，PNG 文件应使用相同尺寸）
             *
             * pngPath 支持绝对路径和相对路径：
             * - 绝对路径：直接使用
             * - 相对路径：依次尝试 <脚本目录>/resources/<pngPath> 和 <项目根目录>/<pngPath>
             *   （脚本目录需要 ctx 中包含 dataDir 和 scriptId）
             *
             * @param pngPath PNG 文件路径（绝对路径或相对路径）
             * @param options 配置选项
             * @returns 相似度 >= threshold 时返回 true
             * @throws {Error} 图片尺寸不一致、clip 属性不完整（透传 screenshot）或读取失败时抛出
             */
            compareScreenshot(
                pngPath: string,
                options?: CompareScreenshotOptions,
            ): Promise<boolean>;
            /** 设置关闭网页前是否弹出二次确认提示（window.onbeforeunload），无参数时默认开启 */
            setBeforeUnload(enabled?: boolean): Promise<void>;
            /** 进入实时测试模式 (REPL)，可输入并执行 puppeteer 代码 */
            startRepl(): Promise<void>;
            /** 设置任务超时，超时后自动关闭浏览器并退出进程，多次调用将重置超时（默认 30 分钟） */
            setTaskTimeout(ms?: number): () => void;
            /**
             * 截图并保存到日志目录，不允许并发（多次调用按顺序排队执行）；returnBuffer 为 true 时返回 Buffer
             * @throws {Error} 以下情况抛出：clip 属性不完整；截图超时；puppeteer 截图失败
             */
            screenshot(
                label?: string,
                options?: {
                    returnBuffer: true;
                    clip?: {
                        x: number;
                        y: number;
                        width: number;
                        height: number;
                    };
                },
            ): Promise<Buffer>;
            /**
             * 截图并保存到日志目录，不允许并发（多次调用按顺序排队执行）；返回保存的文件路径
             * @throws {Error} 以下情况抛出：clip 属性不完整；截图超时；puppeteer 截图失败
             */
            screenshot(
                label?: string,
                options?: {
                    returnBuffer?: false;
                    clip?: {
                        x: number;
                        y: number;
                        width: number;
                        height: number;
                    };
                },
            ): Promise<string>;
            /**
             * 统一的自动化操作函数，自动处理流程控制、日志、截图
             *
             * 一般操作：
             *  - `action('<操作描述>',[['ts', x:number, y:number], ...])` — 触摸开始 - 在指定坐标触发 `touchStart` 事件；如无特别需求，推荐使用 `tt (touch tap)/hold/drag`
             *  - `action('<操作描述>',[['te'], ...])` — 触摸结束 - 触发 touchEnd 事件；如无特别需求，推荐使用 `tt (touch tap)/hold/drag`
             *  - `action('<操作描述>',[['tm', x:number, y:number], ...])` — 触摸移动 - 在指定坐标触发 touchMove 事件；如无特别需求，推荐使用 `tt (touch tap)/hold/drag`
             *  - `action('<操作描述>',[['tt', x:number, y:number], ...])` — 触摸点击 - 在指定坐标触发 tap 事件
             *  - `action('<操作描述>',[['pc', selector:string], ...]])` — 页面点击 - 调用 page.click
             *  - `action('<操作描述>',[['hold', x:number, y:number, duration?:number], ...])` — 长按 - 在指定坐标按下并保持一段时间后释放
             *  - `action('<操作描述>',[['drag', fromX:number, fromY:number, toX:number, toY:number, duration?:number], ...])` — 拖拽 - 从起点拖拽到终点，分步模拟触摸移动
             *  - `action('<操作描述>',[['sleep', ms:number], ...])` — 延时等待 - 暂停指定毫秒数后继续
             *  - `action('<操作描述>',[['fn', (desc, ctx, ...args) => any, [...args]], ...])` — 自定义函数，通过 await 执行，不处理抛错
             *  - `action('<操作描述>',[['mi', msg?:string, ms:number?], ...])` — 请求人工干预，ms 为超时毫秒，默认 15000
             *  - `action('<操作描述>',[['setBeforeUnload', enabled?:boolean], ...])` — 设置关闭网页前是否二次确认（enabled 默认 true）
             *  - `action('<操作描述>',[['cs', pngPath:string, options?:CompareScreenshotOptions, onMatch?:OperationArray, onError?:OperationArray], ...])` — 截图比对，匹配成功执行 onMatch，比对出错执行 onError，匹配失败仅警告
             *
             * 特殊操作：
             *  - `action('waitSceneChange', [操作数组], {timeout?, interval?, threshold?, inverse?, recheckCount?, clip?, referenceFile?})` — 等待场景大幅变化，operations 并行循环执行
             *    - `timeout`: 超时毫秒，默认600000
             *    - `interval`: 截图比对间隔毫秒，默认3000，不少于200（不影响 operations 执行频率）
             *    - `threshold`: 变化阈值，范围[0,1]，默认0.9
             *    - `inverse`: 反向模式，默认false。为true时画面无变化（相似度≥threshold）则继续执行
             *    - `recheckCount`: 复查次数，默认0。>=1时强制截图间隔为3000ms，需连续多次复查通过后才继续执行；复查期间暂停 operations 执行（支持操作级暂停检查）
             *    - `clip`: 截图区域{x, y, width, height}，未提供时使用默认视口区域；提供时属性不完整将抛错
             *    - `referenceFile`: 基准截图文件路径，指定后将使用该文件作为基准图，不再进行首次实时截图
             *    - 注意：operations 必须包含 sleep 操作，否则将跳过执行并输出警告
             *    - 特性：operations 支持操作级暂停检查，进入复查阶段时会在当前操作完成后立即停止，无需等待整个数组执行完毕
             *
             * 调试指令：
             *  - `action('startAt', '<描述1#描述2>')` / `action('startAt', ['<描述1>','<描述2>'])` — 前面的描述链辅助定位，从最后一个描述开始执行 action，覆盖 `--start-at` 命令行参数
             *  - `action('endAt', '<描述1#描述2>')` / `action('endAt', ['<描述1>','<描述2>'])` — 前面的描述链辅助定位，到最后一个描述停止执行 action，覆盖 `--end-at` 命令行参数
             *  - `action('toggleDbg')` — 开启/关闭调试模式（挂起后续 action，等待 next 逐步执行）
             *  - `action('next')` — 调试模式下兑现下一个挂起的 action
             *  - `action('skip')` — 调试模式下跳过下一个挂起的 action
             *
             * 描述链格式: 描述1#描述2，以半角 # 分隔；至少包含一个描述项；只有一个描述项时不使用 # 分隔符
             *
             * 举例：'点击前往#进入咖啡店' 或 '进入生存索引'
             *
             * 强制执行：描述以 `!` 开头时，忽略 `--start-at` / `--end-at` 流程控制，始终执行该 action
             * （既不因未到达 startAt 锚点而跳过，也不推进/触发 endAt 锚点）。
             * 例如 `action('!检查按钮', [...])`；该标记仅影响流程控制，不影响调试模式（toggleDbg）的挂起行为。
             *
             * ---
             */
            action(
                description: string,
                operations?: OperationArray,
                options?: ActionOptions,
            ): Promise<void>;
            /** 调试指令：切换调试模式 */
            action(description: "toggleDbg"): Promise<void>;
            /** 调试指令：调试模式下执行下一个挂起的 action */
            action(description: "next"): Promise<void>;
            /** 调试指令：调试模式下跳过下一个挂起的 action */
            action(description: "skip"): Promise<void>;
            /** 调试指令：覆盖 --start-at / --end-at 命令行参数 */
            action(
                description: "startAt" | "endAt",
                operations: string | string[],
            ): Promise<void>;
            /**
             * 特殊操作：等待场景大幅变化，每次循环执行一次操作数组
             * @throws {Error} `action("waitSceneChange")` 已有实例正在执行中/超时未检测到场景变化时抛错
             */
            action(
                description: "waitSceneChange",
                operations: OperationArray,
                options?: WaitSceneChangeOptions,
            ): Promise<void>;
        }

        // ============ 实例与热重载类型 ============

        /** 脚本实例信息，用于开发模式热重载 */
        interface InstanceInfo {
            /** 实例唯一标识 */
            instanceId: string;
            /** 实例是否已销毁 */
            isDestroyed: boolean;
            /** 是否为热重载产生的实例 */
            isHotReload: boolean;
            /** 热重载是否已启用 */
            hotReloadEnabled: boolean;
            /** 实例清理函数队列 */
            cleanupFunctions: Array<() => any>;
            /** 启用热重载（非开发模式或重复调用时静默） */
            enableHotReload(): void;
        }

        /** action 内部状态，按实例隔离 */
        interface ActionState {
            /** --start-at 解析后的描述链 */
            startAtChain: string[] | null;
            /** --start-at 匹配进度 */
            startAtIndex: number;
            /** 是否已到达 start-at 锚点 */
            startAtReached: boolean;
            /** --end-at 解析后的描述链 */
            endAtChain: string[] | null;
            /** --end-at 匹配进度 */
            endAtIndex: number;
            /** 是否已到达 end-at 锚点 */
            endAtReached: boolean;
            /** 是否已越过 end-at 锚点 */
            endAtPassed: boolean;
            /** 是否已从 ctx 初始化过描述链 */
            stateInitialized: boolean;
            /** 调试模式是否开启 */
            dbgEnabled: boolean;
            /** 调试模式挂起的任务队列 */
            dbgQueue: Array<{
                resolve: (value?: any) => void;
                reject: (e?: any) => void;
                task: () => Promise<void>;
                description: string;
            }>;
            /** 是否有 waitSceneChange 正在执行 */
            waitSceneChangeInProgress: boolean;
        }

        // ============ 数据目录源文件元数据类型 ============

        /** 单个源文件的元数据 */
        interface FileMetadata {
            /** 文件大小（字节） */
            size: number;
            /** 最后修改时间（毫秒时间戳） */
            mtimeMs: number;
        }

        /** 数据目录源文件元数据快照 */
        interface SourceMetadata {
            /** 各相对路径对应的文件元数据 */
            files: Record<string, FileMetadata>;
        }

        // ============ ctx 相关类型 ============

        /** createUtils 接收的 ctx（也是 index.js 提供给脚本的 ctx 的子集） */
        interface UtilsCtx {
            /** puppeteer-core 模块 */
            puppeteer: typeof import("puppeteer-core");
            /** 浏览器实例 */
            browser: Browser;
            /** 页面对象 */
            page: Page;
            /** 日志函数（触发截图钩子） */
            log: (...args: any[]) => void;
            /** 原始日志函数（不触发截图钩子） */
            logRaw: (...args: any[]) => void;
            /** 页面打开时间戳 */
            pageOpenTime: number;
            /** 日志目录绝对路径 */
            logDir: string;
            /** --start-at 解析后的描述链（null 表示未指定） */
            startAtChain?: string[] | null;
            /** --end-at 解析后的描述链（null 表示未指定） */
            endAtChain?: string[] | null;
            /** 获取当前脚本实例信息（index.js 注入，热重载时使用） */
            getInstanceInfo?: () => InstanceInfo | null;
        }

        /** index.js 调用脚本时传入的完整 ctx */
        interface ScriptCtx extends UtilsCtx {
            /** 获取全局配置（config.default.js + 用户配置） */
            getGlobalConfig: () => GlobalConfig;
            /** 工具集工厂，等价于 require("./path/to/utils.js").createUtils */
            createUtils: (ctx: UtilsCtx, _eval?: EvalFn) => Utils;
            /** 加载用户自定义配置文件 */
            loadUserConfig: (
                userConfigPath: string,
                ctx: ScriptConfigCtx,
            ) => {};
            /** 数据目录绝对路径 */
            dataDir: string;
            /** 当前脚本 id */
            scriptId: string;
            /** 启用当前实例的热重载（非开发模式时静默） */
            enableHotReload: () => void;
        }

        interface LoadUserConfigCtx {
            /** 数据目录绝对路径 */
            dataDir: string;
            /** 当前脚本 id */
            scriptId: string;
        }

        /** scripts/<id>/config.default.js 接收的 ctx */
        interface ScriptConfigCtx extends LoadUserConfigCtx {
            /** 加载用户自定义配置文件 */
            loadUserConfig: (
                userConfigPath: string,
                ctx: ScriptConfigCtx,
            ) => {};
        }

        // ============ 脚本函数类型 ============

        /**
         * scripts/<id>/main.js 导出的脚本函数类型
         * @example
         * /// <reference path="../../autoGamer.d.ts" />
         * module.exports = async function(ctx) { ... }
         */
        type ScriptFunction = (ctx: ScriptCtx) => Promise<void>;

        // ============ 全局配置类型 ============

        /** config.default.js 导出的全局配置 */
        interface GlobalConfig {
            /** 开发模式类型
             *
             * 开发模式下会自动禁用定时自动截屏、日志文件写入，且脚本不会自动执行 main 函数
             *
             * 0: 关闭开发模式
             * 1: 开启开发模式（供项目贡献者使用，改变数据目录为 .userData.default/）
             * 2: 开启开发模式（继续使用数据目录 ~/.autoGamer/）
             *
             */
            isDev: 0 | 1 | 2;
            /** Chrome 可执行文件路径配置
             *
             * null: 按操作系统自动寻找内置路径（Linux 下内置路径全部未命中时回退 flatpak 路径）
             * 手动配置优先于内置路径，path 不存在时直接报错
             */
            chromeExecPath:
                | {
                      /** 可执行文件路径 */
                      path: string;
                      /** 是否为 flatpak 应用（仅 Linux 生效，启动前检查并添加
                       * chromeData 目录读写权限；其他平台忽略并警告） */
                      isFlatpak?: boolean;
                  }
                | string
                | null;
            /** 数据目录：开发模式（贡献者）使用项目内 userData.default/，非开发模式使用 ~/.autoGamer/ */
            dataDir: string;
            /** Puppeteer 启动参数 */
            puppeteerArgs: string[];
            /** 移动端 User-Agent */
            mobileUA: string;
            /** 视口配置，极度不建议修改 */
            viewport: Viewport;
            /** 页面加载选项 */
            pageloadOptions: GoToOptions;
            /** 截图功能配置 */
            screenshots: {
                autoScreenshotEnabled: boolean;
                autoScreenshotInterval: number;
                screenshotOnLog: boolean;
                screenshotTimeoutMs: number;
            };
            /** 自动化行为配置 */
            automation: {
                defaultTaskTimeoutMs: number;
                defaultDragSteps: number;
                defaultDragDuration: number;
            };
            /** 是否始终隐藏遮罩层 */
            alwaysHideOverlay: boolean;
            /** 目录配置 */
            dirs: {
                chromeDataDir: string;
            };
            /** 游戏版本更新日是否运行脚本 */
            forceRun: boolean;
            /** 检测到源文件变化时是否自动同步到数据目录（true=自动同步, false=仅警告并提示执行 init） */
            autoSyncSourceFiles: boolean;
            /** 日志文件夹数量警告阈值，logs/ 下所有脚本子目录中文件夹总数超过此值时，退出时提醒清理 */
            logCleanupWarningThreshold: number;
            /** 检查点处理函数，可能被脚本调用 */
            checkpoint: (
                desc: string,
                ctx: ScriptCtx | UtilsCtx,
                ...args: any[]
            ) => any;
            /** 登录脚本 id，login 命令时执行此脚本 */
            loginScriptId: string;
            /** 是否静音浏览器音频 */
            mute: boolean;
        }
    }
    interface Window {
        __autoGamer?: {
            /** 向 Node 端转发触摸/日志事件（由 index.js exposeFunction 注入） */
            simulateTouch?: SimulateTouch;

            /** 全局配置（由 index.js 注入） */
            config?: {
                alwaysHideOverlay?: boolean;
                viewport?: {
                    width: number;
                    height: number;
                };
            };

            /** 初始化注入 UI 与事件监听 */
            mainFn?(): void;

            /** 显示/隐藏悬浮球 */
            toggleBallVisible?(show?: boolean | null): void;

            /**
             * 手动更新十字线坐标并记录操作次数
             *
             * 将十字线移动到指定坐标并显示，同时与上次操作位置比较，
             * 连续同位置（阈值 5px）操作累加计数，在标签上显示 xN 标注。
             * @param x X 坐标
             * @param y Y 坐标
             */
            updateCrosshair?(x: number, y: number): void;

            /** 播放警告音 */
            playWarningSound?(): void;

            /** 请求人工干预，返回用户是否手动结束 */
            requestManualIntervention?(
                msg?: string,
                timeout?: number,
            ): Promise<boolean>;

            /** 懒创建的音频上下文 */
            warningAudioCtx?: AudioContext;
            /** 设置当前缩放比例 */
            setScale?: (scaleX: number, scaleY: number) => void;
        };
        __autoGamerSimulateTouch?: SimulateTouch;
        /** 设置当前缩放比例 */
        __autoGamerSetScale?: (width: number, height: number) => void;
    }
}

export {};
