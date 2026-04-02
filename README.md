# Educoder Local OJ Extension

把 Educoder `shixun_homework` 课堂作业同步到本地 VS Code 工作流中：同步章节索引、按题懒加载源码与 hidden tests、本地评测、官方评测缓存，以及恢复/历史取证能力。

## 当前可用能力

- 剪贴板课堂 URL → 自动同步章节与作业索引
- 打开题目时自动拉取：
  - 当前源码工作区
  - 任务详情元数据
  - hidden tests
  - 原始模板快照
  - 已通过代码快照
  - 答案信息
- 本地评测 / 官方评测 / 强制官方重测
- `Rollback Template`：本地无缓存时自动走远端模板恢复
- `Rollback Passed`：本地无缓存时自动走远端通过代码恢复
- `Sync Task History`：拉取 evaluate logs / redo logs
- `Restore History Snapshot`：按历史 `query_index` 恢复旧版本代码
- Dashboard 展示：
  - hidden tests
  - template
  - passed
  - answer
  - history

## 命令流

1. 在 Edge 中复制 `https://www.educoder.net/classrooms/.../shixun_homework/...` 链接
2. `Educoder Local OJ: Sync Current Collection`
3. `Educoder Local OJ: Open Task`
4. `Educoder Local OJ: Run Local Judge`
5. `Educoder Local OJ: Run Official Judge`

常用恢复/回溯命令：
- `Educoder Local OJ: Rollback Template`
- `Educoder Local OJ: Rollback Passed`
- `Educoder Local OJ: Sync Task History`
- `Educoder Local OJ: Restore History Snapshot`

## 本地目录结构

- `workspace/`：当前编辑中的工作副本
- `_educoder/meta/task.json`：任务详情、myshixun、sec_key 等元数据
- `_educoder/meta/recovery.json`：模板 / passed / answer / history 的缓存状态
- `_educoder/template/`：原始模板快照
- `_educoder/passed/`：已通过代码快照
- `_educoder/answer/`：答案信息与答案正文文件
- `_educoder/history/`：评测历史、redo 历史、历史代码快照
- `_educoder/tests/hidden/`：hidden tests
- `reports/latest_local.json`：本地评测结果
- `reports/latest_remote.json`：官方评测结果

## 开发验证

```bash
npm install
npm test
npm run typecheck
npm run build
npx @vscode/vsce package
```
