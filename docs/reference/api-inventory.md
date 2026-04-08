# Educoder Local OJ API Inventory

> 记录规则：  
> - **静态确认**：源码已直接接入  
> - **运行时确认**：通过 trace / DevTools / 真实链路抓到  
> - **推断**：尚未被真实流量证实

---

## 1. 目标域名

- `www.educoder.net`
- `data.educoder.net`

---

## 2. 章节 / 题目同步相关接口

| Method | Host | Path | 用途 | 状态 |
|---|---|---|---|---|
| GET | data.educoder.net | `/api/courses/:courseId/homework_commons/list.json` | 拉章节 / 作业列表 | 运行时确认 |
| GET | data.educoder.net | `/api/courses/:courseId/left_banner.json` | 拉课程栏目树 / 实训章节 ID 列表 | 运行时确认 |
| GET | data.educoder.net | `/api/shixuns/:shixunIdentifier/challenges.json` | 拉题目列表主路径 | 运行时确认 |
| GET | data.educoder.net | `/api/shixuns/:shixunIdentifier/shixun_exec.json` | 多关卡 fallback | 运行时确认 |
| GET | data.educoder.net | `/api/tasks/:taskId.json` | 题目详情 / task meta / `next_game` | 运行时确认 |
| GET | data.educoder.net | `/api/tasks/:taskId/rep_content.json` | 当前代码 | 运行时确认 |
| GET | data.educoder.net | `/api/tasks/:taskId/check_test_sets.json` | 测试集 | 运行时确认 |
| GET | www.educoder.net | `/api/courses/:courseId/homework_commons.json` | 课堂页面章节信息 | 运行时确认 |
| GET | www.educoder.net | `/api/users/get_user_info.json` | 页面用户信息 | 运行时确认 |

说明：

- 当前真实 `list.json` payload 为顶层 `homeworks`
- 当前真实 `left_banner.json` 可返回 `course_modules[].second_category[]`，其中 `type === "shixun_homework"` 的节点携带章节 `category_id`
- 当前真实 `list.json` 在 `category` 无效/缺失时会返回该课程当前可见 + 未发布的全部实训作业（`category_id/category_name = null`），但不再携带章节名
- 多关卡题目仍需要依赖 `/api/tasks/:taskId.json` 的 `next_game`

---

## 3. 题目资料 / 恢复材料接口

| Method | Host | Path | 用途 | 状态 |
|---|---|---|---|---|
| GET | data.educoder.net | `/api/tasks/:taskId/reset_original_code.json` | 模板代码 | 静态确认 |
| GET | data.educoder.net | `/api/tasks/:taskId/reset_passed_code.json` | 已通过代码 | 静态确认 |
| GET | data.educoder.net | `/api/tasks/:taskId/get_answer_info.json` | 答案列表 | 静态确认 |
| GET | data.educoder.net | `/api/tasks/:taskId/unlock_answer.json` | 答案正文 | 静态确认 |
| GET | data.educoder.net | `/api/tasks/:taskId/evaluate_logs.json` | 历史评测 | 静态确认 |
| GET | data.educoder.net | `/api/tasks/:taskId/redo_logs.json` | redo 历史 | 静态确认 |
| GET | data.educoder.net | `/api/tasks/:taskId/get_content_for_commit_id.json` | 历史代码快照 | 静态确认 |
| POST | data.educoder.net | `/api/myshixuns/:myshixunIdentifier/repository.json` | 远端仓库树 | 静态确认 |

---

## 4. 官方提交流（已产品化）

统一主提交流：

1. 本地运行 `tests/all/`
2. 若通过，上传当前代码
3. 触发官方评测
4. 结构化结果写入内部 `_educoder/judge/` 与 `_educoder/logs/remote/`

具体远端接口：

| Method | Host | Path | 用途 | 状态 |
|---|---|---|---|---|
| POST | data.educoder.net | `/api/myshixuns/:myshixunIdentifier/update_file.json` | 上传 `code/current/` 文件 | 静态确认 + 真实通路复用 |
| POST | data.educoder.net | `/api/tasks/:taskId/game_build.json` | 触发头哥评测 | 静态确认 + 真实通路复用 |

关键参数来源：

- `_educoder/meta/task.json`
  - `taskId`
  - `homeworkId`
  - `challengeId`
  - `myshixunIdentifier`
  - `shixunEnvironmentId`
  - `currentUserId`
  - `userLogin`
  - `editablePaths`

说明：

- 默认主提交流会在本地失败时停止
- `强制提交到头哥` 会继续远端
- `仅提交到头哥评测（高级）` 保留为 remote-only 调试入口
- 本地评测与提交摘要优先在当前题卡片展示，不再把报告文件作为用户主入口

---

## 5. 运行时侦察能力

当前仓库已内置：

- transport trace
- OutputChannel HTTP 日志
- API inventory 聚合
- collection/task 页面 HTML 快照

新增接口发现后，应优先写回：

- `_educoder/raw/`
- `docs/reference/api-inventory.md`
- 对应 sync metadata / raw logs

---

## 6. 不可获取材料约定

当题面 / 测试 / 答案无法从当前接口拿到时，产品面会显式标记：

- `缺失`
- `不可获取`
- `同步失败`

不要把缺少接口返回误写成“已有但未同步”。
