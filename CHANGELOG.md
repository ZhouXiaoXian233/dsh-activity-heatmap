# 变更记录 · Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 的结构，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.0] - 2026-11-03

### 新增

- 侧边栏活动热力图：一格代表一天，支持「近 365 天 / 近 90 天 / 近 30 天 / 全部」四档，并自动铺满窗口宽度。
- 活跃度分档：按你自己近 365 天活跃日的 25 / 50 / 75 分位划分 4 档绿色；活跃日不足 4 天时退化为按当期最大值线性分档。
- 统计卡与「按模型统计」表跟随所选时间段；计费 token 口径为 `input + output + (cacheRead + cacheWrite) × 0.1`。
- 价格设置弹窗：可修改默认单价与每个模型的单价，保存立即生效，无需重启。
- 中英双语界面（`locale/zh.json`、`locale/en.json`）。
- 历史会话首次请求时自动回放补齐，之后通过 `session/event` 实时累加；fork 出来的会话跳过继承事件，重复扫描不会重复计数。
- 只读会话日志（`assistant/message` 事件里的 `usage` 与 `provider:model`），不修改任何会话内容。

### 说明

- 账本位于 `$DSH_HOME/storages/activity-heatmap/state.json`，删除即可清零，重启后重新回放。
- 「打开过应用」由侧边栏图标每 5 分钟发送一次心跳记录。

[Unreleased]: https://github.com/ZhouXiaoXian233/dsh-activity-heatmap/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ZhouXiaoXian233/dsh-activity-heatmap/releases/tag/v0.1.0
