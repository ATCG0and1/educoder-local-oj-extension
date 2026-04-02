# Educoder 答案学习台与完整仓库快照设计文档

**日期：** 2026-04-02  
**分支：** `feature/task8-local-judge`  
**目标：** 在现有“同步章节 + 打开题目 + 本地/官方评测 + 恢复/历史取证”基础上，新增面向学习场景的答案工作台，并补齐完整远端仓库拉取能力，让用户能在 VS Code 中直接获取答案、对比自己代码、复盘历史，并查看完整仓库结构。

---

## 1. 用户价值

当前扩展已经能把题目拉到本地、恢复模板/通过代码、同步历史快照，但对“学习”这一核心场景仍然不够友好：

- 用户只能拿到答案条目元信息，未必能稳定拉到答案正文；
- 即使答案可用，也缺少 current / template / passed / answer / history 的统一对比入口；
- 当前本地工作区主要围绕 editable paths 展开，无法完整还原远端仓库；
- 多文件题、带辅助文件的题、想查看官方仓库全貌的题，仍然不够顺手。

本轮的目标不是把扩展做成“远端 IDE”，而是把它推进成：

> **答案拉取 + 对比学习工作台，并以完整远端仓库快照作为学习底座。**

---

## 2. 方案选型

### 方案 A：只补答案正文抓取
优点：交付最快。  
缺点：只能“下载答案”，不能形成学习闭环，也不能解决完整仓库查看问题。

### 方案 B：答案学习台 + 完整仓库只读快照（采用）
优点：
- 最贴合客户“拉答案学习”的核心诉求；
- 完整仓库可作为对比和理解题目的基础材料；
- 以读操作和本地快照为主，复杂度可控；
- 能复用现有 template / passed / history / dashboard 基础。

缺点：
- 需要新增 repo tree 递归抓取与答案正文拉取能力；
- 需要补一层对比与导出工作流。

### 方案 C：答案学习台 + 远端仓库双向编辑
优点：最终能力最强。  
缺点：首版复杂度过高，容易把学习台主线拖慢。

**采用方案 B：先做“答案学习台 + 完整仓库只读快照”，把远端写操作留到后续。**

---

## 3. 能力边界

### 3.1 本轮纳入范围
1. **完整远端仓库拉取**
   - 递归枚举远端 repository tree；
   - 拉取全部文件内容；
   - 本地保存 canonical remote snapshot。
2. **答案抓取与落盘**
   - `get_answer_info.json`
   - `unlock_answer.json`
   - 对 choice-answer 结构预留兼容字段。
3. **对比学习入口**
   - current vs template
   - current vs passed
   - current vs answer
   - current vs history snapshot
4. **学习导出**
   - 答案正文文件
   - 答案索引与元信息
   - 仓库树索引
5. **dashboard 可视化状态**
   - repo ready / file count
   - answer ready / unlocked count
   - compare / sync / export 动作入口

### 3.2 本轮暂不纳入
- 远端 add/delete/mv/upload 作为主工作流；
- 环境一致性继续深挖；
- 自定义输入测试/self-run 扩展；
- 自动覆盖用户 workspace 的激进同步策略。

---

## 4. 信息架构

在现有 task 目录下继续扩展：

```text
<taskRoot>/
├─ workspace/
├─ reports/
├─ .vscode/
└─ _educoder/
   ├─ meta/
   │  ├─ task.json
   │  ├─ recovery.json
   │  └─ repository.json
   ├─ template/
   ├─ passed/
   ├─ answer/
   │  ├─ info.json
   │  ├─ unlocked/
   │  │  └─ answer-<id>.md
   │  ├─ choose/
   │  └─ export/
   ├─ history/
   ├─ repository/
   │  ├─ tree.json
   │  ├─ index.json
   │  └─ remote/
   │     └─ <full repo snapshot>
   └─ tests/
      └─ hidden/
```

### 4.1 目录职责
- `answer/info.json`：答案条目索引；
- `answer/unlocked/`：已成功解锁的答案正文；
- `answer/export/`：便于学习/导出的整理产物；
- `repository/tree.json`：远端目录树原始结构；
- `repository/index.json`：规范化文件索引（路径、大小、同步时间等）；
- `repository/remote/`：完整仓库快照；
- `meta/recovery.json`：继续承载恢复材料状态，并扩展 answer/repo 字段；
- `meta/repository.json`：保存 repo 拉取状态与统计。

---

## 5. 数据流设计

### 5.1 Open Task
`Open Task` 仍负责把题目尽快变成“可做题 + 可学习”状态：
1. 拉 task detail；
2. 拉 editable source；
3. 拉 hidden tests；
4. 拉 template / passed；
5. 拉 answer info；
6. 写 workspace / template / answer info / task meta；
7. 打开 dashboard。

**不在首次打开时强制全量拉完整仓库，也不强制解锁全部答案正文。**  
原因：避免主链路过重，把完整仓库和答案正文解锁做成显式同步动作。

### 5.2 Sync Task Repository
新增“完整仓库同步”命令：
1. 读取 task manifest / task detail 中的 myshixun 信息；
2. 从仓库根路径开始递归列目录；
3. 对每个 blob 用 `rep_content.json` 拉内容；
4. 写入 `_educoder/repository/remote/`；
5. 更新 `tree.json` / `index.json` / `meta/repository.json`；
6. 刷新 dashboard。

### 5.3 Sync Task Answers
新增“答案正文同步”命令：
1. 读取 `answer/info.json` 或远端重新抓 `get_answer_info`；
2. 对每个可用 `answerId` 调用 `unlock_answer.json`；
3. 将正文写入 `answer/unlocked/answer-<id>.md`；
4. 对正文缺失、锁定、失败分别落状态；
5. 可额外生成 `answer/export/` 学习包。

### 5.4 Compare Flow
对比不做成独立存储格式，而是优先复用 VS Code diff：
- current vs template：`workspace/` ↔ `_educoder/template/`
- current vs passed：`workspace/` ↔ `_educoder/passed/`
- current vs answer：`workspace/` 当前编辑文件 ↔ `answer/unlocked/` 选中答案
- current vs history：`workspace/` ↔ `_educoder/history/commits/<commitId>/`

这样首版最轻，也最符合用户已有的编辑体验。

---

## 6. API 适配层设计

### 6.1 Repository 只读接口
本轮围绕已验证接口构建只读仓库能力：
- `POST /api/myshixuns/:id/repository.json`
- `GET /api/tasks/:taskId/rep_content.json`

其中：
- `repository.json` 用于枚举目录；
- `rep_content.json` 用于拉单文件正文；
- 首版不依赖 `pull_files.json / commit_files.json / reset_repository.json` 的具体语义。

### 6.2 Answer 接口
- `GET /api/tasks/:taskId/get_answer_info.json`
- `GET /api/tasks/:taskId/unlock_answer.json`
- 为 `unlock_choose_answer.json / get_choose_answer.json` 预留兼容模型，但不要求首版完整产品化。

### 6.3 新增 client
建议新增：
- `repositoryFetchClient.ts`
- 扩展 `answerFetchClient.ts`，支持：
  - `fetchAnswerInfo(...)`
  - `unlockAnswer(...)`
  - 后续可扩展 `fetchChooseAnswers(...)`

---

## 7. 本地状态模型与 UI

### 7.1 状态字段扩展
在 `TaskStateModel` 中新增：
- `repositoryReady`
- `repositoryFileCount`
- `unlockedAnswerCount`
- `lastRepositorySyncAt`
- `lastAnswerSyncAt`

### 7.2 Dashboard 展示
新增状态胶囊：
- `repo: ready (N files) / missing`
- `answer unlocked: N`

新增动作入口：
- `Sync Full Repository`
- `Sync Answers`
- `Compare With Template`
- `Compare With Passed`
- `Compare With Answer`
- `Export Learning Bundle`

首版 dashboard 不追求复杂交互，先把动作入口和状态做清楚。

---

## 8. 错误处理与安全边界

### 8.1 基本原则
- **不伪装成功**：答案未解锁、repo 只拉到部分文件，都必须明确记录；
- **不静默覆盖用户代码**：repo 同步默认只写 `_educoder/repository/remote/`；
- **部分成功可接受**：部分答案或部分仓库文件失败，不影响已成功内容落盘；
- **优先只读**：本轮不把远端写操作混入主流程。

### 8.2 典型异常
- `repository.json` 某路径列举失败：在 `index.json` 中记录失败节点；
- `rep_content.json` 单文件失败：保留占位错误项，不中断整体同步；
- `unlock_answer.json` 返回空正文：标为 `empty` / `locked`，不算成功解锁；
- answer info 存在但 answer body 无法获取：允许 metadata-only 状态存在。

---

## 9. 验收标准

### 9.1 仓库能力
- 可以通过显式命令把完整远端仓库递归拉到本地；
- 本地存在 `tree.json`、`index.json` 和完整文件快照；
- dashboard 能正确显示 repo ready 与文件数量。

### 9.2 答案能力
- `get_answer_info` 可落盘；
- 至少一个 `unlock_answer` 正文可稳定落盘；
- dashboard 能显示答案条目数与已解锁正文数；
- 可以导出学习材料，不依赖用户手工再拼。

### 9.3 对比学习能力
- 至少支持 template / passed / answer 三类对比入口；
- 使用 VS Code diff 打开时，路径和命名足够清晰；
- 历史快照仍能作为第四类对比源接入。

### 9.4 工程质量
- 新增 unit / smoke 测试；
- `npm test`、`npm run typecheck`、`npm run build`、`npx @vscode/vsce package` 全通过；
- VSIX 安装后可直接用。

---

## 10. 后续扩展

本轮完成后，下一波可以顺理成章继续：
1. 远端仓库写操作（add/delete/mv/upload）；
2. `reset_repository.json` / `pull_files.json` / `commit_files.json` 语义打通；
3. choose-answer / 非代码题学习支持；
4. 更丰富的复盘台（timeline、笔记、重点标记、批量导出）。
