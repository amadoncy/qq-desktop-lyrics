# v0.1.0 — Windows 便携版

## 下载

| 文件 | 说明 |
|------|------|
| **QQ Desktop Lyrics-0.1.0-Portable.exe** | 绿色便携版，双击即可运行，无需安装 |

**系统要求：** Windows 10 / 11（64 位）

---

## 这是什么

QQ Desktop Lyrics 是一款 Windows 桌面悬浮歌词工具。通过 **Windows SMTC** 同步 QQ 音乐播放进度，自动拉取并显示歌词；UI 采用 3D 时间轴风格（视觉灵感来自 [Sonic Topography](https://github.com/yin-yizhen/sonic-topography)）。

---

## 主要功能

- 透明置顶悬浮歌词窗口（3D 透视 + 时间轴滚动）
- 12 套内置主题、逐字卡拉 OK 高亮、歌词字号调节
- QQ 音乐同步：SMTC 读取进度 + 自动拉取歌词（可选 Cookie）
- Demo 模式 / 本地 LRC 文件加载
- 播放控制（播放/暂停、上一首/下一首）
- 鼠标穿透、窗口不透明度、始终置顶
- 系统托盘 + 设置窗口
- 开机自启、关闭到托盘、启动时隐藏歌词窗口

---

## 快速开始

1. 下载并运行 `QQ Desktop Lyrics-0.1.0-Portable.exe`
2. 打开 **QQ 音乐**，并在 QQ 音乐设置中开启 SMTC：  
   **设置 → 常规 → 通知 → 显示系统媒体传输控件**
3. 右键系统托盘图标 → **设置**，**关闭 Demo 模式**
4. 播放歌曲，歌词窗口会自动同步并滚动

> 鼠标移到窗口 **顶部** 可显示拖动栏与设置按钮；移到底部可显示播放控制。

---

## 注意事项

- 本程序为 **未签名 exe**，Windows SmartScreen 可能提示「未知发布者」，选择「仍要运行」即可
- 便携版首次运行会在用户目录保存配置，卸载时删除 `%APPDATA%\qq-desktop-lyrics` 即可清除数据
- 若某首歌无歌词，可在设置中粘贴 [y.qq.com](https://y.qq.com) 登录后的 Cookie
- 本项目与腾讯 / QQ 音乐官方无关联，仅供学习与个人非商业使用

---

## 完整文档

详见仓库 [README](https://github.com/amadoncy/qq-desktop-lyrics#readme)。
