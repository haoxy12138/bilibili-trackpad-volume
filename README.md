<p align="center">
  <img src="docs/assets/hero.svg" alt="Bilibili Trackpad Volume — 双指上推，播放器音量增加" width="100%">
</p>

<p align="center">
  <a href="https://raw.githubusercontent.com/haoxy12138/bilibili-trackpad-volume/main/bilibili-trackpad-volume.user.js"><img src="https://img.shields.io/badge/Install-User_script-00A1D6?style=for-the-badge" alt="安装用户脚本"></a>
  <a href="https://github.com/haoxy12138/bilibili-trackpad-volume/releases/latest"><img src="https://img.shields.io/github/v/release/haoxy12138/bilibili-trackpad-volume?style=for-the-badge&amp;color=FF6B9A" alt="最新版本"></a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-8BD8BD" alt="MIT 许可证"></a>
  · <a href="README.en.md">English</a>
</p>

# Bilibili Trackpad Volume

**保留 macOS 自然滚动，让 B站全屏画面里的双指上推变成音量增加。**

一个独立的 Tampermonkey 用户脚本：反转播放器收到的滚动方向，音量调整仍由 B站原生逻辑完成。无需校准，无运行时依赖。

## 操作效果

| 场景 | 行为 |
| --- | --- |
| 网页全屏／全屏，指针在视频画面内 | 双指上推增加音量，下推减少音量 |
| 普通播放模式、页面其他区域 | 保留原有滚动行为 |
| 播放器控制条、输入框 | 保留原有事件 |
| 以横向为主的手势、按住 Ctrl／⌘ 的滚动 | 保留原有事件 |

音量步进、静音状态和音量显示由原播放器决定。本脚本不控制系统音量，也不改变 macOS 自然滚动设置。

> **鼠标用户请注意：**脚本不识别输入设备。在目标画面区域内，鼠标滚轮的音量方向也会被反转。它适合主要使用自然滚动触控板的用户。

## 安装

1. 在 Chrome 中启用 [Tampermonkey](https://www.tampermonkey.net/)。已有安装可直接沿用。
2. 进入 Chrome「扩展程序 → Tampermonkey → 详情」，开启「允许运行用户脚本」。
3. **[点击安装脚本](https://raw.githubusercontent.com/haoxy12138/bilibili-trackpad-volume/main/bilibili-trackpad-volume.user.js)**，在 Tampermonkey 的安装确认页核对名称「Bilibili 网页全屏音量方向」后安装。
4. **刷新已经打开的 B站视频页面。**进入网页全屏，把指针移到画面内，再双指上下滑动。

后续只需保持 Tampermonkey、脚本开关和用户脚本运行权限开启。可以关闭管理页面；无需保持任何聊天或开发工具运行。

### 升级与离线安装

- 本地 **v1.0.2** 用户直接点击同一安装入口即可更新：脚本名称和 `@namespace` 保持不变，避免重复安装。更新后刷新视频页面。
- 更新地址指向本仓库。是否自动检查更新，由 Tampermonkey 的设置决定。
- [Releases](https://github.com/haoxy12138/bilibili-trackpad-volume/releases) 提供独立 `.user.js`、Tampermonkey 导入 ZIP 和 SHA-256 校验文件。ZIP 可通过「Tampermonkey 管理面板 → 实用工具 → 导入」安装。

## 实现与作用范围

脚本仅匹配 `https://www.bilibili.com/video/*`，在 `document-start` 的页面主环境中运行。

它代理 `EventTarget.prototype.addEventListener` / `removeEventListener` 中的 `wheel` 和 `mousewheel` 监听器。仅当事件来自全屏播放器画面时，才为原监听器提供一个方向相反的事件代理：`deltaY`、`wheelDelta`、`wheelDeltaY` 取反，其余信息和原生方法保持原来的接收者。

原始事件对象不被改写，不派发伪造事件，也不自行调用音量 API。未匹配的事件直接交回原监听器。移除监听器时保留目标、事件类型和 capture 的对应关系。

当前适配 `.bpx-player-container` / `.bpx-player-video-area`，识别 `data-screen="full"`、`web`、`webfullscreen` 及相关旧版网页全屏类名。控制条和输入区域排除在作用范围之外。

## 权限与隐私

- `@grant none`，无 `@require`、无第三方运行时依赖。
- 脚本运行逻辑不发起网络请求，不读取或保存 Cookie、令牌、账号信息。
- 不导出浏览数据，不收集使用统计。
- 用户脚本管理器可能根据其设置访问本仓库检查更新。

## 兼容与验证

| 环境／项目 | 状态 |
| --- | --- |
| macOS 27.0.1 · Chrome 155 · Tampermonkey 5.5.1 | v1.0.2 核心逻辑经真实触控板操作确认生效 |
| v1.0.3 | 沿用上述事件处理逻辑，移除诊断输出并整理公开发行配置 |
| 方向反转、区域排除、监听器生命周期 | Node.js 自动化测试 |
| 其他浏览器、番剧、直播、嵌入播放器 | 未完成实机验证，不在当前支持承诺内 |

自动化测试不等同于真实触控板验收。B站播放器改版可能需要重新适配。

<a id="troubleshooting"></a>

## 排查与撤销

没有生效时，先确认三个开关都开启，并刷新视频页面。指针需要停在**网页全屏／全屏的视频画面**中；普通模式和音量滑块不属于修复目标。

请避免与其他音量反转脚本、Bilibili Evolved 的「反转滚轮调音量」或其他接管播放器滚动的组件同时启用。重复反转可能抵消效果。

如需撤销，在 Tampermonkey 中停用或删除「Bilibili 网页全屏音量方向」，再刷新视频页面。无需修改系统设置。

仍有问题可[提交 Issue](https://github.com/haoxy12138/bilibili-trackpad-volume/issues/new/choose)，附上浏览器与脚本版本、播放模式和复现步骤即可；请勿提交 Cookie、令牌或私人数据。

## 开发

需要 Node.js 22+；Python 3 仅用于检查发行元数据和生成 ZIP。无需安装 npm 依赖。

```sh
npm run check
npm test
npm run check:release
npm run build
```

发行文件写入 `dist/`。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

已附 [GitHub Actions 工作流模板](docs/ci.yml)。启用时将它保存到 `.github/workflows/ci.yml`；当前仓库尚未启用远程 CI。

## 致谢与许可证

处理思路受到 Max Chang 的 [Bilibili-Trackpad-Scroll-Reverser](https://github.com/maxchang3/Bilibili-Trackpad-Scroll-Reverser) 及其[原理文章](https://maxchang.me/posts/natural-scroll-in-web-video-volume-contorl/)启发。本仓库是独立实现，并非该项目的官方发行版。

[MIT License](LICENSE)。本项目与哔哩哔哩及 Tampermonkey 均无隶属关系。
