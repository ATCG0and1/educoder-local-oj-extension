# Educoder Local OJ Extension

把 Educoder `shixun_homework` 章节同步为一个可直接在 VS Code 里做题、测试、提交的本地题目工作台。

> 推荐安装方式：直接从本仓库 **Releases** 下载 `.vsix`，然后在 VS Code 中执行“Extensions: Install from VSIX...”

---

## 解决什么问题

典型使用流：

1. 粘贴 Educoder 章节 URL
2. 点击 **一键同步本章**
3. 自动拉取本章题目包
4. 直接在 VS Code 的题目树 / Explorer 中切题做题
5. 本地跑测试
6. 通过后再提交到头哥

---

## 主要能力

- **一键同步整章**
  - 自动补齐本地目录
  - 自动把题目包接入当前 VS Code 工作区
- **Task Tree 题目树**
  - 左侧直接切换章节 / 作业 / 题目
- **题目工作台**
  - 自动打开题面、代码、测试、答案等常用入口
- **本地评测**
  - 默认读取 `tests/all`
  - 结果落盘到 `_educoder/judge/latest_local.json`
- **远端提交流**
  - 默认先本地测试，再提交头哥

---

## 安装

### 方式一：从 Release 安装 VSIX（推荐）

1. 打开本仓库的 **Releases**
2. 下载最新的 `educoder-local-oj-extension-*.vsix`
3. 在 VS Code 中打开命令面板
4. 执行 `Extensions: Install from VSIX...`
5. 选择下载好的 `.vsix`

### 方式二：本地开发安装

```bash
npm install
npm run verify
npm run package:vsix
```

然后安装生成的 `.vsix`。

---

## 推荐使用流程

1. 打开 VS Code 左侧 **头哥题目包**
2. 执行 `Educoder Local OJ: 一键同步本章`
3. 首次使用时选择题目包存放目录
4. 等待同步完成
5. 在 `Task Tree` 中切题
6. 修改 `code/current/` 下的代码
7. 执行 **运行本地测试**
8. 通过后执行 **提交评测**

---

## 题目包目录结构

```text
<taskRoot>/
  problem/
    statement.md
  code/
    ...
  tests/
    ...
  answers/
    ...
  _educoder/
    judge/
      latest_local.json
      latest_submit.json
    meta/
    repository/
    raw/
    logs/
    sync.json
```

说明：

- 用户主视角只关注 `problem / code / tests / answers`
- `_educoder/` 保存同步元数据、日志和评测结果

---

## 常用命令

- `Educoder Local OJ: 一键同步本章`
- `Educoder Local OJ: 更换存放目录`
- `Educoder Local OJ: 选择/打开题目`
- `Educoder Local OJ: 打开测试集`
- `Educoder Local OJ: 打开答案`
- `Educoder Local OJ: 打开完整编译报错`
- `Educoder Local OJ: 运行本地测试`
- `Educoder Local OJ: 提交评测（本地 + 头哥）`

---

## 开发

```bash
npm install
npm run verify
npm run release:check
npm run package:vsix
```

本次恢复版本已验证以上命令可通过。
