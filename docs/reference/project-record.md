# Educoder Local OJ 项目记录

## 1. 当前产品基线（2026-04-05）

本仓库已完成从“恢复材料面板”到“完整本地题目包”的重构。

当前用户模型：

- 章节目录同步
- 单题 / 整章拉全题目资料
- 直接在本地题目包里做题
- 默认先跑本地全部测试
- 通过后再提交头哥
- 支持强制提交

---

## 2. Canonical 题目包布局

```text
<taskRoot>/
  README.md
  problem/
  code/current/
  code/template/
  code/passed/
  tests/all/
  tests/visible/
  tests/hidden/
  answers/unlocked/
  reports/
  _educoder/
```

说明：

- `code/current/`：唯一默认编辑入口
- `tests/all/`：本地评测默认测试集
- `answers/`：主学习面
- `_educoder/`：内部原始快照 / 抓包 / 仓库快照 / 调试日志

---

## 3. 已完成的重构结果

### 3.1 目录与同步

- canonical task package surface 已落地
- `openTask` 与 `syncTaskPackage` 已拆分
- 题面同步已成为一等能力
- README / metadata / tests index / answers index 会直接落盘到题目根

### 3.2 本地评测

- 本地评测优先读取 `tests/all/`
- 若旧任务根未迁移，仍可 fallback 到 legacy hidden tests
- 本地报告写入 `reports/latest_local.json`

### 3.3 远端评测与统一提交流

- 远端提交通路继续复用：
  - `update_file.json`
  - `game_build.json`
- 新主命令：
  - `提交评测（本地 + 头哥）`
- 行为：
  - 本地不过默认停止
  - `强制提交到头哥` 可继续远端
  - 远端 only 提交流保留为高级调试命令
- 合并报告写入：
  - `reports/latest_submit.json`

### 3.4 旧布局兼容

旧任务根仍可直接使用：

- `workspace/`
- `_educoder/tests/hidden/`
- `_educoder/answer/`

打开题目时会前向补齐到新布局，但不删除旧文件。

---

## 4. 命令语言冻结

- `同步章节目录`
- `同步并拉全本章资料`
- `拉全题目资料`
- `运行本地测试`
- `提交评测（本地 + 头哥）`
- `强制提交到头哥`

---

## 5. 关键代码分区

### Sync / Workspace
- `src/core/sync/*`
- `src/core/workspace/*`

### Judge
- `src/core/judge/*`
- `src/core/remote/*`

### Commands / UI
- `src/commands/*`
- `src/views/*`
- `src/webview/*`
- `src/core/ui/*`

### Auth / API / Runtime
- `src/core/auth/*`
- `src/core/api/*`
- `src/core/runtime/*`
- `src/core/recon/*`

---

## 6. 已确认的真实通路

### 官方提交流

- 上传：`POST /api/myshixuns/:myshixunIdentifier/update_file.json`
- 评测：`POST /api/tasks/:taskId/game_build.json`

### 章节 / 题目同步

- 课堂 URL → collection index
- `list.json` 顶层 `homeworks`
- `challenges.json` / `shixun_exec.json`
- `/api/tasks/:taskId.json` 串 `next_game`

---

## 7. 当前完成标准

本轮重构只有在以下条件同时满足时才算完成：

- `npm test` 通过
- `npm run typecheck` 通过
- `npm run build` 通过
- VSIX 可打包
- canonical task package 可直接使用
- 本地优先提交流可用
- 旧布局任务根仍可安全打开 / 评测 / 提交
