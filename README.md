# 🎮 autoGamer

专为第三方云游戏平台而生的 自动化游戏工具，基于 Puppeteer。默认使用移动端咪咕快游网页版，内置原神、崩坏：星穹铁道（WIP）自动脚本。

## ✨ 特色
- 专为第三方云游戏平台而生
- 死板但简单的自动化操作
- 主要使用触控操作游戏
- 可配置浏览器路径、参数、视口等
- 实时 REPL 调试

## 🚀 使用方法

1. 安装依赖：
   ```bash
   pnpm install
   ```
2. 首次使用前初始化数据目录（非开发模式必须）：
   ```bash
   node index.js init
   ```
3. 启动脚本：
   ```bash
   node index.js login [可选登录URL]
   node index.js sr        # 运行崩坏：星穹铁道脚本
   node index.js zzz       # 运行绝区零脚本
   ```
4. 配置参数：
   - 全局配置：编辑数据目录下的 `globalConfig.js`（首次运行自动创建）
   - 脚本配置：编辑数据目录下的 `scriptData/<脚本id>/config.js`（首次运行自动创建）

> 数据目录：开发模式为项目内 `userData.default/`，非开发模式为 `~/.autoGamer/`


## 📁 目录结构
- `index.js`                主入口
- `src/`                    源代码目录
  - `loader.js`             主程序，负责初始化环境、运行脚本等
  - `config.default.js`     全局默认配置
  - `loadUserConfig.js`     用户配置加载器
  - `logger.js`             日志模块
  - `utils.js`              工具函数
  - `browser/`              浏览器相关
    - `injectPage.js`       注入页面脚本
  - `loader/`               加载器相关
    - `dataInit.js`         数据初始化
    - `injector.js`         注入器
  - `utils/`                工具函数拆分
    - `action.js`           操作相关
    - `screenshot.js`       截屏相关
- `userData.default/`       源数据目录（开发模式即为数据目录）
  - `scripts/<id>/main.js`           自动化脚本入口
  - `scripts/<id>/config.default.js` 脚本默认配置
  - `scripts/<id>/resources/`        脚本资源文件（如图片）
  - `share/*.js`                     共享函数
  - `autoGamer.d.ts`                 类型声明
  - `README.md`                      内置脚本说明
- 数据目录（运行时生成，开发模式即 `userData.default/`，非开发模式即 `~/.autoGamer/`）：
  - `globalConfig.js`                用户全局配置
  - `scriptData/<id>/config.js`      用户脚本配置
  - `logs/<id>/<timestamp>/`         日志
  - `chromeData/`                    浏览器用户数据

## 🛠️ 开发指引

设置环境变量进入开发模式，数据目录将切换为项目内 `userData.default/`，并禁用部分自动化行为，方便本地调试：

```bash
# Linux / macOS
export AUTOGAMER_DEV=1
node index.js example

# Windows (PowerShell)
$env:AUTOGAMER_DEV=1
node index.js example
```

开发模式下行为变化：
- 自动禁用定时自动截屏
- 自动禁用日志事件截图
- `scripts/` 下的脚本不会自动执行 `main()` 函数，页面加载完成后直接进入 REPL
- 日志仅输出到终端，不写入 `logs/` 目录下的文件

> 💡 **共享登录态**：非开发模式下可手动创建软链接，让 `~/.autoGamer/chromeData` 复用开发模式的浏览器会话，避免重复登录：
> ```bash
> ln -s /path/to/autoGamer/userData.default/chromeData ~/.autoGamer/chromeData
> ```

## 📄 许可证

Copyright (c) 2025~2026 dsy4567

GPL-3.0-or-later, 见 COPYING 文件。
