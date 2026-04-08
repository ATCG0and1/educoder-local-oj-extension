# Edge 登录态复用 + 分层诊断日志 + 章节页 HTML 快照（Design）

**日期：** 2026-04-03

## 背景与问题

当前用户体验存在两类核心痛点：

1. **登录时打开的 Edge 不是“日常 Edge”**：现有登录兜底会启动临时 `--user-data-dir`，导致账号登录态不复用。
2. **排错成本高**：失败时只有一条弹窗 message，缺少分阶段证据（URL→认证→网络→落盘）。
3. **“整页拉取”需求**：用户希望至少能把章节页（`classrooms/.../shixun_homework/...`）的 HTML 落盘，作为取证/解析材料。

此外，已通过无登录态抓取验证：课堂页在未登录时仅能拿到导航/登录入口内容，因此“整页拉取”必须使用扩展获取到的 session cookie 携带请求。

## 目标（Goals）

- G1：提供一种模式，使扩展可以**复用日常 Edge 的登录态**获取 `_educoder_session`（不再启动临时 profile）。
- G2：为关键命令链路提供 **OutputChannel 诊断日志**，并体现“分层错误原因”。
- G3：在 `Sync Current Collection` 中，支持把章节页 HTML **落盘为快照文件**（第一版仅保存服务器返回的原始 HTML）。

## 非目标（Non-goals）

- 不做：读取/解密 Edge Cookies 数据库（Windows DPAPI + SQLite）第一版不实现。
- 不做：Playwright 渲染后的最终 DOM、静态资源（js/css/img）全量镜像。
- 不做：跨浏览器（Chrome/Firefox）无感复用；第一版聚焦 Edge。

## 方案概述（Approved: 方案 B）

### 1) “日常 Edge 复用模式”（Debug Port）

- 新增命令：`Educoder Local OJ: Enable Edge Reuse (Debug Mode)`
  - 扩展启动 **默认 Edge profile** 的浏览器进程，开启 `--remote-debugging-port=<port>`。
  - 扩展把端口号保存到 VS Code `globalState`，后续认证链路优先尝试连接该端口读取 cookie。
  - 该 Edge 窗口即用户的“日常 Edge 登录态”，不会使用临时 profile。

- 认证优先级保持一致：
  1) 缓存 session（`globalState`）
  2) Edge 复用（先读 `globalState` 存储的 debug port，再读 `EDUCODER_EDGE_DEBUG_PORT` 环境变量）
  3) 登录兜底：当检测到用户已启用 Edge 复用模式时，不再启动临时 profile，而是提示用户在 Debug Edge 中完成登录后重试。

> 安全说明：remote debugging 仅绑定 127.0.0.1，扩展只读取 cookie **是否存在**与必要字段，不记录 cookie 值到日志。

### 2) OutputChannel 分层诊断日志

- 新建输出通道：`Educoder Local OJ`
- 新增命令：`Educoder Local OJ: Show Logs`
- 日志要求：
  - 每次命令执行生成 trace id，记录 start/end、耗时
  - 分阶段记录：URL 解析 → session 解析（cache/edge/login）→ 网络请求（status/耗时）→ 落盘路径
  - 错误时记录 error chain（含 `cause`）与关键上下文，但 **禁止输出 cookie 值**

- UI 行为：命令失败时弹窗仍展示简短 message，同时补充“详见输出：Educoder Local OJ”。

### 3) 章节页 HTML 快照落盘

- 在 `Sync Current Collection` 完成章节索引同步后：
  - 用当前 session 对 `https://www.educoder.net/classrooms/<courseId>/shixun_homework/<categoryId>?tabs=0` 发起 GET
  - 保存到 `${collectionRoot}/collection.page.html`
  - 另存 `${collectionRoot}/collection.page.meta.json`：`{ url, fetchedAt, size, contentType }`

- 失败策略：
  - 失败不阻断章节索引同步（索引是主能力；页面快照是附加材料）
  - 失败原因写入日志

## 数据与存储

- `globalState` keys（建议）：
  - `educoderEdgeDebugPort`: number
  - `educoderEdgeReuseEnabled`: boolean（或以 port 是否存在判断）

- 快照落盘：
  - `collection.page.html`
  - `collection.page.meta.json`

## 测试策略

- Unit tests：
  - debug port 的存取逻辑（不真实启动 Edge）
  - error chain 格式化与敏感信息脱敏
  - `Sync Current Collection` 在提供 pageFetcher stub 时会写入快照文件

- Smoke tests：保持现有 smoke 测试不依赖真实网络；新增的功能点通过依赖注入 stub 验证。

## 验收标准

- 用户执行 `Enable Edge Reuse (Debug Mode)` 后：
  - 后续同步不再启动临时 `--user-data-dir` 的 Edge
  - 能从 debug port 提取到 `_educoder_session`（不在日志中泄露值）

- 任意一次失败：
  - 弹窗提示可读
  - OutputChannel 内可看到分阶段日志 + error chain

- 执行 `Sync Current Collection`：
  - `${collectionRoot}/collection.page.html` 与 `.meta.json` 成功生成（若因登录态不足失败，应有日志）。
