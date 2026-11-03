# 活动热力图 · Activity Heatmap

给 DeepSeek Harness 加一张类似 GitHub 个人主页的日历热力图：**一格 = 一天**，颜色深浅表示当天使用了多少；同时统计 token 消耗并给出估算金额。

## 安装

- **插件市场**：在 DSH 的插件市场里搜索 `dsh-activity-heatmap`（或「活动热力图」），一键安装。
- **npm**：`dsh-activity-heatmap`（`dsh.bundle.patch` + `dsh.client`，装完即出现在侧边栏，无需改配置）。
- **本地开发**：把仓库路径以 `link:` 形式装进 profile，改完文件后停用/启用一次即可热重载。

## 使用

- 侧边栏底部图标行最右侧多出一个热力图图标，点开即进入「活动热力图」整页。
- 默认显示**近 365 天**的格子，并自动铺满窗口宽度；右上角可切「近 365 天 / 近 90 天 / 近 30 天 / 全部」，格子数量随之变化。
- 统计卡与「按模型统计」表都跟随所选时间段。

## 颜色

| 颜色 | 含义 |
| --- | --- |
| 灰 | 当天没有任何记录（含没打开应用） |
| 最浅绿 | 当天打开过应用，但没有发起对话 |
| 浅绿 → 深绿（4 档） | 当天活跃度按**你自己近 365 天活跃日的 25 / 50 / 75 分位**分档 |

活跃度分 = `对话轮数 + 模型调用次数 + 计费 token ÷ 10000`，其中计费 token = `input + output + (cacheRead + cacheWrite) × 0.1`（缓存命中按 1/10 权重计，否则长上下文会话会把分数拉爆）。活跃日不足 4 天时退化为按当期最大值线性分档。

## 数据来源

只读会话日志（`assistant/message` 事件里的 `usage` 与 `provider:model`），**不修改任何会话内容**。历史会话在首次请求时自动回放补齐；之后的对话通过 `session/event` 实时累加。每个会话记录已折叠到的事件序号，重复扫描不会重复计；fork 出来的会话会跳过继承事件。

「打开过应用」由侧边栏图标每 5 分钟发一次心跳记录。

账本：`$DSH_HOME/storages/activity-heatmap/state.json`（删除即可清零，重启后重新回放）。
诊断：同目录 `probe.log`（请求记录）、`last-payload.json`（最近一次下发的数据）。

## 单价与估算金额

页面上的**「价格设置」按钮**打开弹窗，可直接改默认价与每个模型的单价，保存后立即生效（写入 `$DSH_HOME/storages/activity-heatmap/config.json`，无需重启）。

- 单位：元 / 1M tokens。`缓存命中` / `缓存未命中` / `输出` 三档。
- 没有单独设置的模型使用**默认价**，默认值即 DeepSeek 官方参考价 **0.2 / 2 / 3**。
- **`custom-api:*` 是私有网关，没有公开价格**，要准确金额必须在弹窗里填自己的单价。
- 也可以直接改配置文件（同样即时生效）：

```json
{
  "currency": "CNY",
  "default": { "cacheMiss": 2, "cacheHit": 0.2, "output": 3 },
  "models": {
    "custom-api:deepseek-flash": { "cacheMiss": 4, "cacheHit": 1, "output": 16 }
  }
}
```
