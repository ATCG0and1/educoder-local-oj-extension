# Educoder 侧边栏工作台设计文档

**日期：** 2026-04-02  
**分支：** `feature/task8-local-judge`  
**目标：** 给扩展补上安装后立刻可见、可点击、可开始使用的侧边栏入口，解决“命令存在但没有 UI、Open Task 也无法直接选题”的可发现性与可用性缺口。

---

## 1. 问题确认

当前扩展虽然已经有 dashboard panel，但真实体验上仍然接近“无 UI”：

- `package.json` 里没有 `viewsContainers` / `views`，所以 Activity Bar 不会出现图标；
- dashboard 只会在 `Open Task` 成功后弹出；
- 现有 `educoderLocalOj.openTask` 命令默认要求传入 `taskRoot`，普通用户从命令面板直接点基本打不开；
- 结果就是：VSIX 安装成功，但用户看不到入口，也不知道第一步该做什么。

这不是“缺一个按钮”，而是 **启动路径没有闭环**。

---

## 2. 方案选型

### 方案 A：独立 Activity Bar 图标 + 固定侧边栏工作台视图（采用）
- 在 Activity Bar 增加 `Educoder OJ` 图标；
- 点击后展示固定工作台视图；
- 视图内提供开始动作和当前任务摘要；
- 视图本身作为“入口”，原有 dashboard panel 继续保留，作为打开题目后的详情面板。

**优点：**
- 最符合用户预期：安装后立刻能看到；
- 不破坏现有 panel 逻辑；
- 后续能继续扩展任务树、最近任务、状态聚合。

**缺点：**
- 需要新增 `WebviewViewProvider` 与一层状态同步。

### 方案 B：挂在 Explorer 里
改动较小，但不够显眼，不足以解决“装了不会用”。

### 方案 C：直接做成树形任务浏览器
长期价值高，但本轮目标是先补可见入口与启动闭环，没必要一步做到最重。

**结论：采用方案 A。**

---

## 3. 本轮范围

### 3.1 纳入范围
1. Activity Bar 新增 `Educoder OJ` 图标；
2. 新增 `educoderLocalOj.sidebar` 侧边栏视图；
3. 侧边栏展示：
   - 扩展简介 / 当前状态；
   - `Sync Current Collection`
   - `Open Task`
   - `Refresh`
   - 当前已选任务的摘要与学习动作；
4. `Open Task` 在未传 `taskRoot` 时支持 QuickPick 选题；
5. 打开题目后同步刷新侧边栏与现有 dashboard panel；
6. README 补充真实使用路径。

### 3.2 暂不纳入
- 完整树形任务浏览器；
- 侧边栏内直接运行本地/官方评测；
- 复杂状态持久化（例如最近任务列表、多 collection 切换器）；
- 替换现有 dashboard panel。

---

## 4. 交互设计

## 4.1 首次安装 / 尚未同步
侧边栏显示：

- 标题：`Educoder Local OJ`
- 简短引导：
  1. 点击 `Sync Current Collection`
  2. 再点击 `Open Task`
- 按钮：
  - `Sync Current Collection`
  - `Open Task`
  - `Refresh`

此时不要求用户先知道命令名，也不要求用户手工传路径参数。

## 4.2 已同步但未打开具体题目
侧边栏仍显示全局动作；
`Open Task` 会弹出 QuickPick，列出本地产品目录下已同步的 task。

QuickPick 每项显示：
- 主标题：任务名
- 描述：作业名
- 细节：课程 / 章节

## 4.3 已打开题目
侧边栏显示两部分：
1. 全局动作；
2. 当前任务卡片（复用现有 dashboard 状态信息）：
   - readiness / hidden tests / template / passed / answer / repo / history
   - `Sync Full Repository`
   - `Sync Answers`
   - `Compare With Template`
   - `Compare With Answer`

原有 panel 继续保留，用于更宽的详情视图；侧边栏负责“常驻入口 + 当前题摘要”。

---

## 5. 技术设计

## 5.1 视图容器
在 `package.json` 中新增：

- `contributes.viewsContainers.activitybar.educoderLocalOj`
- `contributes.views.educoderLocalOj.educoderLocalOj.sidebar`
- `activationEvents` 增加 `onView:educoderLocalOj.sidebar`

同时添加一个轻量 SVG 图标。

## 5.2 侧边栏实现方式
采用 `WebviewViewProvider`，不采用 TreeView。

原因：
- 现有 dashboard 就是 webview HTML，最容易复用；
- 当前界面主要是状态摘要 + 动作按钮，不是层级数据浏览；
- 后续若要增加任务树，也可以在下一轮独立演进。

## 5.3 状态同步
新增一个轻量级 dashboard/sidebar 状态协调层，负责：

- 记录当前 `taskRoot`；
- 在 `openTask` 成功后刷新侧边栏；
- 在侧边栏按钮执行命令后刷新当前任务状态；
- 在没有当前任务时渲染引导态。

这层状态只在扩展运行期内维护，不在本轮做复杂持久化。

## 5.4 Open Task 交互补全
为了解决“有侧边栏入口但仍然打不开题目”，需要补一个交互式打开流程：

- 当 `educoderLocalOj.openTask` 收到 `taskRoot` 时：保持现有行为；
- 当未收到 `taskRoot` 时：
  1. 从本地产品根目录扫描 `collection.manifest.json / homework.manifest.json / task.manifest.json`；
  2. 组装 QuickPick 项；
  3. 让用户选择 task；
  4. 再调用既有 `openTaskCommand(taskRoot, deps)`。

这样既兼容旧调用，也补齐普通用户入口。

---

## 6. 错误处理

- 未设置本地 OJ 根目录：沿用现有目录选择逻辑；
- 本地尚无任何已同步 task：QuickPick 前提示“请先同步章节”；
- 侧边栏按钮执行命令失败：不吞错，沿用命令本身错误冒泡；
- 当前任务不存在或被删除：侧边栏退回引导态；
- 刷新时若无当前任务：只刷新首页，不报错。

---

## 7. 测试策略

### 单测
1. `openTask` 交互模式：
   - 无 `taskRoot` 时能弹 QuickPick；
   - 选中 task 后调用既有 openTask 逻辑；
2. 侧边栏 provider：
   - 注册成功；
   - 能渲染引导态；
   - 打开任务后能渲染任务态；
   - 点击 webview 按钮能执行命令并刷新。

### 烟测
1. 扩展激活后存在侧边栏视图注册；
2. 打开任务后侧边栏与 panel 都能显示正确状态；
3. `npm test` / `npm run typecheck` / `npm run build` / `vsce package` 全通过。

---

## 8. 验收标准

满足以下条件即视为本轮完成：

1. 安装 VSIX 后，Activity Bar 能看到 `Educoder OJ` 图标；
2. 点开图标后，侧边栏能看到“Sync Current Collection / Open Task / Refresh”；
3. 不传 `taskRoot` 时，`Open Task` 可以直接选题；
4. 选题后原有 dashboard panel 仍可正常弹出；
5. 侧边栏可展示当前任务摘要与学习动作；
6. 构建、测试、打包全部通过。
