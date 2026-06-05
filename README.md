# ChatGPT Obsidian Capture

一个隐私优先的 Chrome 扩展，用来把**当前打开、已经加载的 ChatGPT 对话**手动归档到 Obsidian。

它不会遍历历史会话，不读取 cookie / token，不调用 ChatGPT 内部 API，也不会把对话上传到任何服务器。你点击“更新归档”时，扩展才会读取当前页面内容，并把 Markdown / JSON 写入你授权的本地文件夹。

## 功能特性

- 手动导出当前 ChatGPT 对话为 Markdown 和 JSON。
- 支持选择 Obsidian vault 或 vault 内任意文件夹作为归档目录。
- 同一会话使用稳定文件名，重复更新会覆盖旧文件，避免生成一堆版本文件。
- Markdown 使用 Obsidian 友好的 front matter。
- Markdown 大纲按“用户问题摘要”组织，方便在 Obsidian 目录中快速跳转。
- 保留代码块为 fenced code block，尽量转换表格和链接。
- 为消息生成 `content_hash` 和 `message_key`，用于本地去重状态判断。
- 页面右侧显示轻量归档面板，提示是否有新内容未同步。
- 圆环进度提示下一次自动检查时间点，不显示数字倒计时。
- 自动提醒只做轻量消息计数，不读取全文、不计算 hash。

## 适用场景

这个工具适合：

- 把 ChatGPT Business / Team / 个人账号中的重要对话沉淀到 Obsidian。
- 手动整理高价值对话，而不是后台全量爬取。
- 希望保留原始问答上下文，并让 Markdown 文件能被 Obsidian 大纲导航。
- 对隐私敏感，不希望扩展读取认证信息或调用非公开接口。

不适合：

- 自动备份所有历史对话。
- 静默批量导出整个工作区。
- 完整保存 Canvas、附件、图片和隐藏分支。

## 安装

目前这是本地开发版扩展，需要用 Chrome 的 unpacked extension 方式安装。

1. 下载或 clone 本仓库。
2. 打开 Chrome 的 `chrome://extensions/`。
3. 启用右上角的“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本仓库根目录，也就是包含 `manifest.json` 的目录。

安装完成后，Chrome 工具栏会出现 `ChatGPT 当前对话归档` 扩展按钮。

## 使用方法

1. 打开 `https://chatgpt.com/` 或 `https://chat.openai.com/` 中的一条对话。
2. 等当前页面内容加载完成。
3. 点击扩展按钮。
4. 首次使用时点击“选择归档文件夹”。
5. 选择你的 Obsidian vault 或 vault 内的归档文件夹，并授权写入。
6. 点击“更新归档”。
7. 在授权文件夹中查看导出的 `.md` 和 `.json` 文件。

以后同一条对话再次点击“更新归档”时，会覆盖同名文件，而不是生成多个版本。

## 页面右侧归档面板

打开任意 ChatGPT 对话页时，页面右侧会出现一个轻量归档面板。

面板包含：

- `ChatGPT 归档` 标题。
- 圆环进度：顺时针填充，表示下一次自动检查的时间点。
- 同步状态：例如 `约 3 条未同步` 或 `已同步`。
- `更新归档` 按钮：打开扩展 popup，由 popup 执行写入。
- `↻` 按钮：立即做一次轻量检查。

为了避免拖慢长对话加载，右侧面板不会读取全文，也不会计算 hash。它只低频统计当前页面已加载的消息数量，用来做“约 N 条未同步”的提醒。准确去重会在你点击“更新归档”时完成。

## 导出 Markdown 格式

Markdown 文件适合直接放入 Obsidian。

文件名格式：

```text
YYYY-MM-DD - sanitized-title - conversation-id.md
```

内容包含：

- YAML front matter。
- Capture Info。
- 长对话加载提示。
- 按用户问题组织的 Messages。

示例结构：

```markdown
---
source: chatgpt-business
capture_method: chrome-extension
conversation_id: "abc"
title: "示例对话"
url: "https://chatgpt.com/c/abc"
captured_at: "2026-06-05T10:30:00.000Z"
updated_at: "2026-06-05T10:30:00.000Z"
message_count: 4
tags:
  - chatgpt/workspace
  - ai-conversation
---

# 示例对话

## Capture Info

- Source: ChatGPT current page
- Conversation ID: abc
- URL: https://chatgpt.com/c/abc
- Captured at: 2026-06-05T10:30:00.000Z
- Message count: 4

## Messages

### Obsidian 有没有相关插件？

**你：**

Obsidian 有没有相关插件？

**ChatGPT：**

可以考虑这些方案...
```

这样 Obsidian 的大纲里主要显示每一轮用户问题，而不是 `message 1` / `message 2` 这类机械标题。

## 导出 JSON 格式

JSON 文件用于保留结构化数据和后续自动化处理。

文件名格式：

```text
YYYY-MM-DD - sanitized-title - conversation-id.json
```

核心字段：

```json
{
  "source": "chatgpt-business",
  "capture_method": "chrome-extension",
  "conversation_id": "abc",
  "title": "示例对话",
  "url": "https://chatgpt.com/c/abc",
  "captured_at": "2026-06-05T10:30:00.000Z",
  "message_count": 2,
  "messages": [
    {
      "message_key": "sha256...",
      "role": "user",
      "index": 1,
      "text": "消息内容",
      "content_hash": "sha256...",
      "source_timestamp": null,
      "captured_at": "2026-06-05T10:30:00.000Z"
    }
  ]
}
```

## 去重逻辑

扩展会为每条消息生成两个 hash：

```text
content_hash = sha256(normalized_text)
message_key = sha256(conversation_id + role + normalized_text)
```

其中 `normalized_text` 会做基础标准化：

- trim 首尾空白。
- 统一换行。
- 合并多余空白。
- 去掉明显的 UI 文案。
- 保留代码块内容。

扩展会把每个会话的已保存消息 key 记录在 `chrome.storage.local` 中。再次打开同一会话时，可以提示是否有新内容未同步。

## 权限说明

`manifest.json` 只申请最小权限：

```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*"
  ]
}
```

这些权限用途：

- `activeTab`：用户点击扩展时，读取当前 ChatGPT 页面。
- `scripting`：点击 popup 操作时临时注入抓取脚本。
- `storage`：保存本地归档状态。
- `host_permissions`：只允许在 ChatGPT 域名运行轻量提醒面板。

扩展不申请：

- `cookies`
- `debugger`
- `webRequest`
- `tabs`
- `nativeMessaging`

## 隐私与安全

扩展遵循这些边界：

- 不上传任何对话内容到第三方服务器。
- 不读取 cookie。
- 不读取 access token、session 或 localStorage 中的认证信息。
- 不调用 ChatGPT 内部或非公开 backend API。
- 不使用 Chrome debugger API。
- 不后台遍历历史聊天。
- 不在用户未点击导出按钮时写入对话全文。
- 归档文件夹授权只保存在扩展本地 IndexedDB 中。
- 会话同步状态只保存在 `chrome.storage.local` 中。

## 项目结构

```text
chatgpt-obsidian-capture-extension/
  manifest.json
  src/
    auto_watcher.js   # 页面右侧轻量状态面板，只做低频计数
    background.js     # badge、popup 打开、同步完成通知
    content.js        # popup 触发后的完整抓取入口
    file_access.js    # File System Access API 文件夹授权与写入
    hashing.js        # 文本标准化和 SHA-256
    markdown.js       # Markdown / JSON 导出结构
    options.*         # 扩展设置页
    parser.js         # ChatGPT DOM 解析
    popup.*           # 扩展弹窗 UI
    storage.js        # chrome.storage.local 状态管理
```

## 开发与验证

本项目没有构建步骤，直接加载源码目录即可。

语法检查：

```bash
for f in src/*.js; do node --check "$f" || exit 1; done
python3 -m json.tool manifest.json >/dev/null
```

本地调试建议：

1. 在 `chrome://extensions/` 中打开开发者模式。
2. 点击扩展卡片上的“重新加载”。
3. 刷新 ChatGPT 页面。
4. 打开 DevTools 查看 console。
5. 点击扩展按钮测试导出。

## 已知限制

- 只保存当前页面已经加载的内容。
- 长对话需要手动滚动到顶部，确认历史消息已加载后再保存。
- 不支持自动打开或遍历历史对话。
- 不保证完整保存 Canvas、附件、图片和隐藏分支。
- ChatGPT 页面 DOM 可能变化，若页面结构改变，消息识别可能需要更新选择器。
- 页面右侧面板的 `约 N 条未同步` 是轻量估算，不是最终 hash 去重结果。

## Roadmap

- 支持用户自定义 Markdown 模板。
- 支持只导出 delta 增量文件。
- 支持可配置自动检查频率。
- 支持附件和图片引用保存。
- 支持 Obsidian URI 快速打开归档文件。
