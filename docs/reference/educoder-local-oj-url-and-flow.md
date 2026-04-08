# Educoder Local OJ：网址/接口/数据流参考

> 目的：把“这个扩展到底访问哪些 URL、如何从浏览器复用登录态、产物文件写到哪”记录成一份可复用的排错与维护手册。

## 1. 项目定位（What / Why）

- **项目名**：Educoder Local OJ Extension
- **目标**：把 Educoder 的 `shixun_homework` 课堂作业同步到本地 VS Code 工作流中（章节索引、题目懒加载、hidden tests、本地评测/官方评测、恢复取证等）。
- **核心链路**：
  1) 解析课堂 URL（clipboard / 手动输入）
  2) 获取/复用登录态（session cookies）
  3) 调 `data.educoder.net` API 拉章节与题目索引
  4) 写入本地目录结构与 manifest
  5) （附加）拉取章节页 HTML 快照落盘，便于取证/离线分析

## 2. VS Code 命令（用户入口）

- `Educoder Local OJ: Sync Current Collection`
  - 从剪贴板解析 `classrooms/<courseId>/shixun_homework/<categoryId>`
  - 同步章节索引到本地目录
  - 额外落盘章节页快照（见第 5 节）

- `Educoder Local OJ: Enable Edge Reuse (Debug Mode)`
  - 用**默认 Edge profile**启动一个带 `--remote-debugging-port=<port>` 的 Edge 窗口
  - 扩展通过 DevTools 协议读取 cookie，实现“复用日常 Edge 登录态”的效果
  - 端口保存在 VS Code `globalState`（key：`educoderEdgeDebugPort`）

- `Educoder Local OJ: Show Logs`
  - 打开 OutputChannel：`Educoder Local OJ`

## 3. 登录态/认证（Session）

扩展需要至少拿到 `_educoder_session` 才能访问 `data.educoder.net` 的接口。

### 3.1 Session 解析优先级

1) **缓存 session**（VS Code `globalState`）：`educoderSessionCookies`
2) **Edge 复用（DevTools）**
   - 优先：`globalState` 中持久化端口 `educoderEdgeDebugPort`
   - 兜底：环境变量 `EDUCODER_EDGE_DEBUG_PORT`
3) **交互式登录兜底（临时 profile）**
   - 仅当未启用 Edge 复用时才会使用
   - 若已启用 Edge 复用（端口存在）但仍拿不到 cookie，会给出可执行提示（不会再弹临时 profile）

### 3.2 Edge DevTools 读取 cookie 的网络与协议

- HTTP 列表：
  - `http://127.0.0.1:<port>/json/list`
- WebSocket：
  - 从 `json/list` 返回的 `webSocketDebuggerUrl`
- DevTools 方法：
  - `Network.getAllCookies`
- 目标 cookie：
  - `_educoder_session`
  - `autologin_trustie`（可选）

> 注意：如果 Edge 已经在运行，重新启动带 `--remote-debugging-port` 的实例可能会失败（新窗口复用旧进程导致参数不生效）。这时需要用户关闭所有 Edge 再运行 `Enable Edge Reuse`。

## 4. 网址与接口清单（URL / API）

### 4.1 用户复制的课堂页（路由）

- 章节作业页（用于解析 courseId/categoryId）：

`https://www.educoder.net/classrooms/<courseId>/shixun_homework/<categoryId>?tabs=0`

示例：
- `https://www.educoder.net/classrooms/ufr7sxlc/shixun_homework/1316861?tabs=0`

### 4.2 数据 API（扩展实际拉索引）

- Base：`https://data.educoder.net`

- 课程栏目 / 章节树：
  - `GET /api/courses/<courseId>/left_banner.json`
  - 可从 `course_modules[].second_category[]` 中发现 `type === shixun_homework` 的章节 `category_id`
  - 适合做“整学期实训同步”的章节枚举入口

- 章节作业列表：
  - `GET /api/courses/<courseId>/homework_commons/list.json`
  - Query（典型）：
    - `id=<courseId>`
    - `type=4`
    - `category=<categoryId>`
    - `status=0`
    - `page=1`
    - `limit=100`
    - `order=0`

- 题目列表（优先）：
  - `GET /api/shixuns/<shixunIdentifier>/challenges.json`

- 题目列表（fallback）：
  - `GET /api/shixuns/<shixunIdentifier>/shixun_exec.json`

### 4.3 请求头（session 相关）

- `Cookie: _educoder_session=...; autologin_trustie=...`
- `Pc-Authorization: <_educoder_session>`

> 日志与快照元数据中禁止记录 cookie 值（已通过脱敏/不落盘保证）。

## 5. 本地落盘产物（Artifacts）

### 5.1 章节索引

- `${collectionRoot}/collection.manifest.json`

### 5.2 章节页快照（附加材料）

- `${collectionRoot}/collection.page.html`
- `${collectionRoot}/collection.page.meta.json`
  - `ok: true|false`（false 仅代表抓取/落盘失败）
  - `warning?: string`（壳页面/疑似未登录等启发式提示）
  - `fetchedAt`、`sizeBytes`、`contentType` 等
- `${collectionRoot}/collection.page.error.txt`
  - 抓取失败或启发式 warning 的文字说明

> 重要：该快照保存的是**服务器返回的原始 HTML**。如果目标路由是前端渲染（CSR），原始 HTML 可能是“壳页面”，需要结合 JS/接口数据才能得到“浏览器渲染后的整页”。

## 6. 真实服务验证（建议手顺）

1) 关闭所有 Edge 窗口
2) 运行 `Enable Edge Reuse (Debug Mode)`，在打开的 Edge 里完成登录并保持窗口打开
3) 复制课堂 URL 到剪贴板
4) 运行 `Sync Current Collection`
5) 查看 OutputChannel：`Show Logs`
6) 检查 `${collectionRoot}` 下快照与 meta

## 7. 相关实现位置（便于维护/追踪）

- URL 解析：`src/core/url/educoderUrl.ts`
- 会话解析策略：`src/core/auth/educoderSessionResolver.ts`
- Edge DevTools 取 cookie：`src/core/auth/edgeReuse.ts`
- 端口持久化：`src/core/auth/edgeDebugPortStore.ts`
- 同步章节入口：`src/commands/syncCurrentCollection.ts`
- 快照落盘：`src/commands/syncCurrentCollection.ts`（依赖注入 `fetchCollectionPageHtml`）
- 默认 wiring：`src/extension.ts`
