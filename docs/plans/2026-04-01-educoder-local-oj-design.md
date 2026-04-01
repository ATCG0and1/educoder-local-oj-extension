# Educoder Local OJ 零配置原版体验设计文档

**日期：** 2026-04-01  
**分支：** `feature/task8-local-judge`  
**目标：** 让 VS Code 扩展尽可能复现头歌原版做题体验：用户复制课堂 `shixun_homework` 链接后即可同步章节作业、打开题目、在本地直接跑所有数据集（包含 hidden tests），不需要手工导入数据或手抄 cookie；认证失败时允许弹出 Educoder 登录页作为兜底。

---

## 1. 用户体验目标

### 1.1 核心体验
用户只需要：
1. 在浏览器打开头歌课堂作业页；
2. 复制 `https://www.educoder.net/classrooms/.../shixun_homework/...` 链接；
3. 在 VS Code 运行 `Educoder Local OJ: Sync Current Collection`；
4. 打开任意题目开始写代码；
5. 运行本地评测时，默认就在全部数据集（包括 hidden tests）上跑；
6. 需要时再触发官方评测进行对照。

用户不应该关心：
- cookie/session 如何拿到；
- 题目源码、模板、参考答案、hidden tests 存到哪里；
- 本地目录结构如何组织；
- 哪些数据需要额外导入。

### 1.2 体验边界
- **主入口** 是剪贴板中的作业 URL 自动解析。
- **兜底入口** 是弹窗手动粘贴 URL。
- **认证优先级**：缓存 session → 静默复用 Edge → 弹出登录页。
- **hidden tests 要本地化**，且首次打开某题后应缓存到本地，以后本地评测直接复用。
- **范围不限第二章**。第二章只是首个验证样板，最终目标是任意 `shixun_homework` URL 都可工作。

---

## 2. 当前实现与差距

### 2.1 已有基础
仓库当前已具备：
- URL 解析雏形：`src/core/url/clipboardUrlResolver.ts`、`src/core/url/educoderUrl.ts`
- session 管理雏形：`src/core/auth/sessionManager.ts`
- collection manifest、task 目录骨架：`src/core/sync/*`、`src/core/workspace/*`
- 本地判题、官方判题缓存骨架：`src/core/judge/*`、`src/core/remote/*`
- dashboard 状态模型与静态资源：`src/core/ui/stateModel.ts`、`src/webview/dashboard/*`

### 2.2 关键缺口
当前仍未达到“可在 VS Code 正常使用”的标准：
- `loadSessionFromEdge()` 尚未实现，无法自动复用 Edge 登录态；
- `extension.ts` 仍依赖测试态 override，真实 service graph 未接好；
- `syncCurrentCollection()` 只 hydrate 第一个作业的第一个 task；
- 真实 task 详情、源码文件、hidden tests 抓取流程未正式接入；
- `openTaskCommand()` 仅返回 model，尚无真实 VS Code dashboard 面板；
- 目录命名仍偏 ID 化，未体现网页真实章节/作业名称。

---

## 3. 方案选型

### 方案 A：在现有 mock 骨架上继续补洞
优点：改动小。  
缺点：很容易继续维持“测试能过、用户不能用”的状态。

### 方案 B：URL 驱动的一键同步 + 双层认证兜底 + 按题懒加载
优点：最符合目标体验，复杂度可控。  
缺点：需要把认证、同步、UI 一次梳理清楚。

### 方案 C：首次整章全量镜像全部题目与全部数据
优点：离线体验好。  
缺点：慢、脆、失败面大，不适合先做通用可用版。

**采用方案 B。**

---

## 4. 信息架构与目录组织

目录命名要使用网页真实名称，同时保留稳定 ID：

```text
<EducoderRoot>/
└─ 数据结构 [ufr7sxlc]/
   └─ 第二章 线性表及应用 [1316861]/
      ├─ chapter.manifest.json
      ├─ 2-1 基本实训：查找给定元素值在顺序表中出现的次数 [3727447]/
      │  ├─ homework.manifest.json
      │  └─ 01 任务 [fc7pz3fm6yjh]/
      │     ├─ task.manifest.json
      │     ├─ workspace/
      │     ├─ reports/
      │     ├─ .vscode/
      │     └─ _educoder/
      │        ├─ meta/
      │        ├─ template/
      │        ├─ answer/
      │        ├─ passed/
      │        ├─ history/
      │        └─ tests/
      │           └─ hidden/
      └─ 2-2 基本实训-链表操作 [3727439]/
         └─ 01 链表操作 [fc7pz3fm6yjh]/
```

### 目录原则
- 使用 **网页/API 真实名称** 作为目录显示名；
- 追加 `[id]` 保证路径稳定、避免重名；
- 对 Windows 非法字符做 sanitize；
- `workspace/` 仅保存用户正在编辑的工作副本；
- `_educoder/` 负责存放模板、答案、元数据、缓存测试与历史快照；
- `reports/` 保留本地与官方评测结果；
- manifest 继续作为增量同步和 dashboard 数据源。

---

## 5. 认证设计

### 5.1 认证优先级
1. **缓存 session**：优先读取 VS Code SecretStorage/globalState 中的已验证 session；
2. **静默复用 Edge 登录态**：自动从本机 Edge 会话中提取 `_educoder_session` 与 `autologin_trustie`；
3. **弹出登录页**：静默复用失败时自动打开头歌登录页，用户正常登录后由扩展接管有效 session 并缓存。

### 5.2 认证原则
- 用户不需要手填 cookie；
- 登录失败时要明确提示且允许重试；
- 一旦登录成功，应能跨 VS Code 重启继续使用；
- session 失效时应自动再验证并重新走复用/登录流程。

---

## 6. 同步与数据抓取设计

### 6.1 章节同步
`Sync Current Collection` 只负责：
- 解析 URL；
- 获取课程/章节基本信息；
- 拉取该章节全部作业列表；
- 写入课程/章节/homework/task manifest；
- 生成名称正确的目录骨架；
- 刷新 dashboard 总览。

### 6.2 按题懒加载
具体题目数据在“打开题目”或“显式同步该题”时拉取：
- `tasks/{taskId}.json?...`：题面、题目路径、测试元数据；
- `rep_content.json?...`：可编辑源码文件；
- answer / passed / history 等可用材料；
- hidden tests：若可提取则落盘并缓存；
- `.vscode/tasks.json`、`launch.json`：供本地编译/调试。

### 6.3 hidden tests 策略
- hidden tests 是 **P0 能力**；
- 不要求首次整章全量拉满，但要求**按题首次打开时自动拉取并缓存**；
- 本地评测必须默认跑缓存好的 hidden tests；
- 若某题 hidden 拉取失败，UI 必须明确显示“未完成本地化”，不能伪装成完整原版体验。

---

## 7. VS Code 交互设计

### 7.1 命令
保留并实装：
- `Sync Current Collection`
- `Open Task`
- `Run Local Judge`
- `Rerun Failed Cases`
- `Run Official Judge`
- `Force Run Official Judge`
- `Rollback Template`
- `Rollback Passed`

### 7.2 Dashboard
Dashboard 作为原版体验的总览页，至少展示：
- 当前课程、章节名称；
- homework/task 树；
- 每题同步状态、hidden 缓存状态、本地判题状态、官方判题状态；
- 最近一次同步/评测时间；
- 一键打开题目、一键重拉当前题、一键本地评测、一键官方评测。

### 7.3 UI 风格
后续 UI 美化以 VS Code 深色主题适配为主，方向是：
- 深色、工程感、低噪音；
- 左侧结构树 + 右侧状态卡；
- hidden/local/official 三段式状态胶囊；
- 明确展示“本地已覆盖 hidden tests”的可信状态。

---

## 8. 验收标准

满足以下条件才算“正常可用”：

### 8.1 链路
- 剪贴板 URL 自动解析可用；
- 手动粘贴 URL 兜底可用；
- 扩展命令无需测试 override；
- 新安装 VSIX 后即可直接运行。

### 8.2 登录
- 有缓存 session 时直接使用；
- 缓存失效时尝试 Edge 复用；
- 复用失败时可弹登录页并继续；
- 用户无需手填 cookie。

### 8.3 数据
- 能列出章节下全部 homework；
- 目录按真实章节/作业名称落盘；
- 任意已同步题目都能打开为本地 workspace；
- hidden tests 可按题拉取并本地缓存；
- 本地评测默认跑全部缓存测试（含 hidden）。

### 8.4 UI
- `Open Task` 真正打开 dashboard / 题目视图；
- dashboard 中能看到同步状态、hidden 状态、本地/官方评测状态；
- 主要操作可在 VS Code 内完成，不要求用户手工导入数据。

### 8.5 验证样板
- 用“第二章 线性表及应用”做首轮端到端验证；
- 再用另一个章节 URL 复测，证明不是写死第二章。

---

## 9. 风险与缓解

1. **Edge 会话复用不稳定**  
   缓解：允许自动降级到登录页，并在成功后持久缓存 session。

2. **hidden tests 抽取路径可能因题型不同而变化**  
   缓解：建立通路探测与状态标识；未拿到 hidden 的题不标记为“完整本地化”。

3. **真实名称路径包含 Windows 非法字符或超长路径**  
   缓解：统一 sanitize、必要时缩短中间片段，但保留真实名称和 ID。

4. **现有测试主要覆盖骨架，缺少真实服务 wiring 与 dashboard 集成验证**  
   缓解：后续实施计划中补齐 unit/smoke/集成验证。

---

## 10. 结论

本项目后续实施以 **方案 B** 为准：
- 复制 URL 自动解析是主入口；
- 手动粘贴 URL 是兜底；
- 认证走“缓存 → Edge → 登录页”；
- 目录使用真实名称 + ID；
- 章节先同步索引，题目按需懒加载；
- hidden tests 必须本地化并参与本地判题；
- 最终目标是在 VS Code 中尽量复现头歌原版做题体验，而不是让用户自己管理数据。
