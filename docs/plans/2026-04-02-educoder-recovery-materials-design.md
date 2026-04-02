# Educoder Local OJ 恢复与取证工作台设计文档

**日期：** 2026-04-02  
**分支：** `feature/task8-local-judge`  
**目标：** 在现有“同步章节 + 打开题目 + 本地/官方评测 + hidden tests 本地化”基础上，补齐恢复、回溯、取证能力，让用户能直接在 VS Code 中恢复原始模板、恢复已通过代码、查看答案信息、同步评测/重做历史，并按 commit 导入历史快照。

---

## 1. 用户价值

### 1.1 现阶段痛点
当前扩展已能把题目拉到本地并完成评测，但仍缺少头歌原版中高频且实用的“恢复类”能力：
- 用户改坏代码后，不能总是可靠恢复到题目模板；
- 已通关题目的通过代码不一定总在本地缓存；
- 平台可查看的答案信息、评测记录、历史版本没有结构化落盘；
- 当前 `Rollback Template` / `Rollback Passed` 更像“恢复本地镜像”，不是“面向真实接口的恢复工作台”。

### 1.2 本轮要解决的问题
用户在本地做题时，应直接获得以下能力：
1. 一键恢复**原始模板**；
2. 一键恢复**已通过代码**；
3. 本地查看**答案信息/答案条目**；
4. 同步并保存**evaluate logs / redo logs**；
5. 按 commit 拉取并导入**历史代码快照**；
6. 在 dashboard 中明确看到这些材料当前是否可用。

---

## 2. 方案选型

### 方案 A：只增强本地 snapshot，不接更多接口
优点：实现快。  
缺点：只能恢复“之前已经拉过的本地文件”，仍然不是完整恢复体验。

### 方案 B：构建“恢复与取证工作台”（采用）
优点：
- 与已验证接口直接对接；
- 以读操作和本地缓存为主，风险低；
- 对用户最有实用价值；
- 能自然复用到 dashboard 和后续远程文件能力。

缺点：
- 需要补一层新的 recovery material client 和本地索引。

### 方案 C：直接进入远程 repository 双向编辑
优点：更接近官网在线 IDE。  
缺点：状态复杂，容易破坏当前稳定性，不适合作为下一波首选。

**采用方案 B：先把恢复、回溯、取证补齐，再继续远程编辑与 self-run。**

---

## 3. 能力边界

### 3.1 本轮纳入范围
- `GET /api/tasks/:taskId/reset_original_code.json`
- `GET /api/tasks/:taskId/reset_passed_code.json`
- `GET /api/tasks/:taskId/get_answer_info.json`
- `GET /api/tasks/:taskId/evaluate_logs.json`
- `GET /api/tasks/:taskId/redo_logs.json`
- `GET /api/tasks/:taskId/get_content_for_commit_id.json`

并把它们产品化为：
- 本地缓存；
- 恢复命令；
- dashboard 可视化状态；
- 历史快照导入能力。

### 3.2 本轮暂不纳入
- 远程 repository 树浏览/增删改上传；
- self-run 在线日志流；
- 自动覆盖用户工作区的激进同步策略。

---

## 4. 信息架构

在现有 task 目录下扩展 `_educoder/`：

```text
<taskRoot>/
├─ workspace/
├─ reports/
├─ .vscode/
└─ _educoder/
   ├─ meta/
   │  ├─ task.json
   │  └─ recovery.json
   ├─ template/
   │  └─ test1/tasks.h
   ├─ passed/
   │  └─ test1/tasks.h
   ├─ answer/
   │  ├─ info.json
   │  └─ answer-3567559.md
   ├─ history/
   │  ├─ evaluate_logs.json
   │  ├─ redo_logs.json
   │  ├─ index.json
   │  └─ commits/
   │     └─ <commitId>/...
   └─ tests/
      └─ hidden/
```

### 4.1 目录职责
- `template/`：远端“原始模板”快照；
- `passed/`：远端“已通过代码”快照；
- `answer/`：答案元信息及答案正文；
- `history/`：评测日志、redo 日志、commit 级快照；
- `meta/recovery.json`：汇总恢复材料状态，供 dashboard 直接读取。

---

## 5. 数据流设计

### 5.1 Open Task
`Open Task` 的第一优先级仍然是把题目变成可做题状态：
1. 拉 task detail；
2. 拉源码；
3. 拉 hidden tests；
4. 写 workspace / template / task meta；
5. 打开 dashboard。

在此基础上增加“轻量恢复材料预取”：
- 自动拉取原始模板；
- 自动拉取已通过代码；
- 自动拉取答案信息元数据；
- **不在首次打开时全量拉 history commit 内容**，避免拖慢主链路。

### 5.2 Rollback Template / Rollback Passed
增强为真实恢复链：
1. 检查本地 `_educoder/template` 或 `_educoder/passed` 是否已有缓存；
2. 若无，则自动调用远端接口拉取；
3. 写入本地快照目录；
4. 仅在用户主动执行命令时覆盖 `workspace/`；
5. 写回 `recovery.json` 并刷新 dashboard。

### 5.3 Answer / History 显式同步
- `Sync Task Recovery Materials`：补齐模板、passed、answer info；
- `Sync Task History`：拉 `evaluate_logs / redo_logs`，建立 commit 索引；
- `Restore History Snapshot`：按 commit 获取文件内容并导入本地快照，再由用户决定是否恢复到 `workspace/`。

---

## 6. API 适配层设计

在现有 `taskDetailClient / sourceFetchClient / hiddenTestFetchClient` 之外新增：
- `templateFetchClient.ts`
- `passedFetchClient.ts`
- `answerFetchClient.ts`
- `historyFetchClient.ts`

### 6.1 设计原则
- client 只负责请求远端并规范化返回；
- 不让 client 直接写工作区；
- 文件写入、索引维护、恢复动作由 sync/workspace 层完成；
- 尽量复用 `TaskDetailSummary` 中已有的 `homeworkId / editablePaths / myshixunId / secKey` 等字段。

### 6.2 统一返回模型
新 client 返回统一的结构化数据，例如：
- `WorkspaceFile[]` 用于模板、passed、历史快照；
- `AnswerInfoSummary` 用于答案元数据；
- `HistoryIndex` 用于 commit 列表和日志摘要。

---

## 7. 本地状态模型与 UI

### 7.1 TaskStateModel 扩展
在当前字段基础上新增：
- `templateReady`
- `passedReady`
- `answerEntryCount`
- `historyCommitCount`
- `lastRecoverySyncAt`

### 7.2 Dashboard 展示
当前 dashboard 已显示：
- readiness
- hidden tests

本轮新增状态胶囊：
- `template: ready / missing`
- `passed: ready / missing`
- `answer: N entries / missing / locked`
- `history: N commits`

并增加动作入口：
- 同步恢复材料；
- 查看答案信息；
- 同步历史；
- 导入历史快照。

---

## 8. 安全与错误处理

### 8.1 基本原则
- **不伪装成功**：接口不可用时必须明确标记；
- **不静默覆盖用户代码**：只有用户主动点恢复/导入，才覆盖 `workspace/`；
- **部分成功可接受**：例如 history 中部分 commit 拉取失败，不影响已成功部分落盘。

### 8.2 典型异常处理
- `reset_passed_code` 无内容：标记 `passedReady = false`；
- `get_answer_info` 返回开放但无正文：标记 `metadata_only`；
- `evaluate_logs / redo_logs` 请求失败：保留历史索引为空并记录错误摘要；
- `get_content_for_commit_id` 某个 commit 失败：仅在 `index.json` 里记录失败状态，不中断整个 history 同步。

---

## 9. 验收标准

### 9.1 恢复能力
- fresh task root 上执行 `Rollback Template` 可自动远端拉取并恢复模板；
- fresh task root 上执行 `Rollback Passed` 可自动远端拉取并恢复已通过代码；
- 恢复后 `workspace/` 与快照一致，旧文件被正确替换。

### 9.2 回溯能力
- `get_answer_info.json` 可落盘并在本地查看；
- `evaluate_logs.json`、`redo_logs.json` 可落盘；
- 至少一个 commit 可通过 `get_content_for_commit_id.json` 导入为本地快照。

### 9.3 UI 能力
- dashboard 明确显示 template / passed / answer / history 状态；
- 这些状态在同步或恢复后会刷新；
- 不存在“本地看起来可恢复，但实际没有缓存”的假阳性状态。

### 9.4 工程质量
- 新增 unit / smoke 测试；
- `npm test`、`npm run typecheck`、`npm run build`、`npx @vscode/vsce package` 全通过；
- VSIX 安装后功能可直接用。

---

## 10. 后续扩展接口

本轮做完后，下一波可直接建立在这层恢复与取证基础之上：
1. 远程 repository tree 与文件操作；
2. self-run / log_output / game_status；
3. 更完整的 dashboard 操作区；
4. 针对多文件题目的远程-本地双向同步。
