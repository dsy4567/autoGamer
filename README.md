# 🎮 autoGamer

专为第三方云游戏平台而生的 自动化网页游戏脚本工具，基于 Puppeteer。默认使用移动端咪咕快游网页版，内置原神、崩坏：星穹铁道（WIP）自动脚本。

## ✨ 特色
- 专为第三方云游戏平台而生
- 死板但简单的自动化操作
- 主要使用触控操作游戏
- 支持 win、Linux，可配置浏览器路径、参数、视口等
- 实时 REPL 调试

## 🚀 使用方法

1. 安装依赖：
   ```bash
   pnpm install
   ```
2. 启动脚本：
   ```bash
   node index.js login [可选登录URL]
   node index.js s/ys.js
   ```
3. 配置参数：
   编辑 `config.js` 可自定义浏览器路径、UA、登录页等。

## 📁 目录结构
- `index.js`         主入口
- `inject.js`        注入脚本
- `s/ys.js`, `s/sr.js` `s/example.js` 示例自动化脚本
- `config.js`        全局配置
- `utils.js`         工具函数

## 📄 许可证

Copyright (c) 2025 dsy4567

MIT License, 见 LICENSE 文件。
