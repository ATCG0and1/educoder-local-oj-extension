# Educoder 任务树侧边栏设计文档

**日期：** 2026-04-02  
**分支：** `feature/task8-local-judge`  
**目标：** 在现有 Activity Bar 工作台基础上，补上“章节 → 作业 → 题目”的树形导航，让用户不再依赖命令面板或 QuickPick，就能从侧边栏直接浏览并打开本地已同步题目。

---

## 1. 设计目标

上一轮已经补上了可见入口和常驻 Workbench，但实际使用时仍有一个明显缺口：

- 用户能看到侧边栏；
- 也能点 `Open Task`；
- 但题目仍然主要靠 QuickPick 选择，不够“导航化”。

本轮目标是把侧边栏进一步补成：

> **左边看树，点题即开；右边保留当前题工作台。**

---

## 2. 信息架构

在 `Educoder OJ` Activity Bar 容器中放两个 view：

1. **Task Tree**
   - 层级：`章节 → 作业 → 题目`
   - 点击题目节点即执行 `Open Task`
2. **Workbench**
   - 继续显示当前题状态、学习动作、同步动作

课程层不显示在树里，但会作为章节节点的补充描述信息保留。

---

## 3. 数据来源

树视图只读本地 manifest，不走远端 API。

扫描路径：

```text
<root folder>/Educoder Local OJ/
  <course>/
    <chapter>/
      collection.manifest.json
```

再从 `collection.manifest.json` 里展开：
- chapter 信息
- homework 列表
- task 列表

并据此还原每个 `taskRoot`。

这样首版有几个好处：
- 速度快；
- 不依赖登录；
- 不会在激活时弹任何网络或路径交互；
- 和当前本地同步模型完全一致。

---

## 4. 交互约定

### 4.1 无本地根目录 / 尚未同步
- Tree 显示为空；
- Workbench 继续提示先 `Sync Current Collection`。

### 4.2 已同步
- Tree 根层显示章节节点；
- 展开后显示作业；
- 再展开后显示题目；
- 点击题目节点直接打开对应 task。

### 4.3 打开题目后
- Tree 不需要额外选中高亮逻辑作为本轮硬要求；
- Workbench 自动切换到当前题摘要；
- 原有 dashboard panel 行为保持不变。

---

## 5. 技术方案

## 5.1 TreeDataProvider
新增 `TaskTreeProvider`：

- `getChildren(undefined)` 返回章节节点；
- `getChildren(chapter)` 返回作业节点；
- `getChildren(homework)` 返回题目节点；
- 题目节点带 `command`：
  - `educoderLocalOj.openTask`
  - 参数为 `taskRoot`

## 5.2 本地目录扫描
新增本地 catalog 层，把 manifest 扫描从 `openTaskInteractive` 中抽出来复用：

- `scanLocalTaskCatalog(productRoot)`
- `listLocalTaskEntries(productRoot)`

这样：
- Task Tree 用层级 catalog
- QuickPick 用扁平 task list

避免两套扫描逻辑分叉。

## 5.3 刷新策略
新增 `TaskTreeProvider.refresh()`。

刷新时机：
- `Sync Current Collection` 成功后；
- 手动刷新 tree；
- 扩展激活后首次展开 tree。

本轮不要求文件系统 watcher。

---

## 6. 错误处理

- 根目录未设置：tree 返回空；
- 产品目录不存在：tree 返回空；
- 某个 collection manifest 损坏：跳过该 collection，不拖垮整个 tree；
- task 节点路径不存在：仍允许显示，由 `Open Task` 真实报错。

---

## 7. 验收标准

1. Activity Bar 的 `Educoder OJ` 下能看到两个 view：
   - `Task Tree`
   - `Workbench`
2. Task Tree 能显示 `章节 → 作业 → 题目`
3. 点击题目节点能直接打开题目
4. `Sync Current Collection` 后 Task Tree 会刷新出新节点
5. `npm test` / `npm run typecheck` / `npm run build` / `vsce package` 全通过
