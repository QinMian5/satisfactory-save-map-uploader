# Satisfactory Save Map Uploader

[English](../../README.md) | [简体中文](README.zh-CN.md)

[![CI](https://github.com/QinMian5/satisfactory/actions/workflows/ci.yml/badge.svg)](https://github.com/QinMian5/satisfactory/actions/workflows/ci.yml)
[![Release](https://github.com/QinMian5/satisfactory/actions/workflows/release.yml/badge.svg)](https://github.com/QinMian5/satisfactory/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
![Windows](https://img.shields.io/badge/platform-Windows-0078D4.svg)

Satisfactory Save Map Uploader 是一个非官方 Windows 桌面应用。它会把你选择的 Satisfactory `.sav` 存档上传到 Satisfactory Calculator 交互式地图，并在同一个窗口中保持地图打开。

本项目不隶属于 Coffee Stain Studios、Coffee Stain Publishing 或 Satisfactory Calculator，也未获得它们的认可或赞助。

## 下载

从 [GitHub Releases](https://github.com/QinMian5/satisfactory/releases) 下载 Windows 构建：

- `SatisfactorySaveMapUploader-Installer-<version>-x64.exe` 是带安装向导的 Windows 安装器。
- `SatisfactorySaveMapUploader-Portable-<version>-x64.zip` 解压后即可运行，不需要安装。

未签名的 beta 构建可能触发 Windows SmartScreen 提示。

## 功能

- 首次启动先显示授权页；未授权前不会扫描存档、开始监控、打开地图或上传文件。
- 使用 Windows 默认的 Satisfactory 存档目录。
- 可以手动上传最新存档。
- 点击 **开始自动上传** 后，可以在新存档出现时自动上传。
- 复用一个内嵌的 Satisfactory Calculator 地图视图。
- 支持英文和简体中文界面，并打开对应语言的地图页面。
- 可以从应用中打开当前存档所在文件夹。

## 隐私

应用只在本地运行，但上传功能的实现方式是把选中的 `.sav` 文件提供给第三方 Satisfactory Calculator 网页。该网页可以读取文件内容以及普通浏览器上传流程中的信息。

应用开发者不会接收或保存你的存档文件，也没有内置分析或遥测。请只上传你愿意提供给该第三方页面的存档。

## 快速开始

1. 启动应用。
2. 如有需要，先切换界面语言。
3. 点击 **允许上传** 授权。
4. 点击 **上传最新存档** 执行一次上传，或点击 **开始自动上传** 监控新存档。
5. 使用 **暂停自动上传** 停止自动上传，但保留授权。
6. 使用 **禁用上传** 撤销授权并退出。下次启动会回到授权页。

## 常见问题

- 如果没有找到存档，请先打开 Satisfactory 并在默认本地存档目录创建一次存档。
- 如果地图没有更新，请等待 Satisfactory Calculator 页面加载完成后再点击 **上传最新存档**。
- 如果网站离线或修改了上传界面，上传可能会失败，直到应用更新适配。
- 如果 Windows 阻止运行，请先核对发布产物和 checksum，再决定是否继续运行。

## 开发

前置要求：Node.js、通过 Corepack 使用的 pnpm，以及用于安装 git hooks 的 uv。

```powershell
pnpm install
pnpm run dev
pnpm run check
pnpm run package
pnpm run make:installer
pnpm run make:portable
```

`pnpm run dev` 启动 Electron 开发应用。`pnpm run check` 运行 Biome、TypeScript 和 Vitest。`pnpm run package` 创建未打包安装器的 Windows 应用目录。`pnpm run make:installer` 和 `pnpm run make:portable` 在 `out/make` 下创建发布产物。

更多项目细节见[设计规格](../specs/designs/save-map-uploader.md)、[发布策略](../release-policy.md)、[隐私说明](../../PRIVACY.md)和[安全策略](../../SECURITY.md)。

## 许可证

MIT。见 [LICENSE](../../LICENSE)。
