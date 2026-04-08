# Educoder Local OJ 全面重构设计文档

**日期：** 2026-04-04  
**状态：** 执行中  
**约束：** 用户已明确要求“不再询问，直接持续工作到核心功能实现为止”。

---

## 1. 重构目标

当前项目的主要问题不是“缺某个功能”，而是**运行时、认证、文档、侦察能力混在一起**，导致：

- 登录链路与用户真实使用习惯冲突；
- 会话校验过弱，出现“点已登录但后续请求仍报错”；
- `extension.ts` 过重，依赖构造分散；
- 接口枚举与抓包能力没有沉淀成统一机制；
- 文档很多，但缺少一套明确的 canonical docs。

本轮重构目标是把项目整理成**可持续推进**的结构，而不是继续在旧图上缝补。

## 2. 方案比较

### 方案 A：继续在现有图上点修
- 优点：快
- 缺点：会继续堆高耦合和文档噪音

### 方案 B：保留现有模块名，重建共享 runtime 和文档体系
- 优点：风险可控，能逐步替换旧逻辑
- 缺点：需要先处理基础设施，再推进功能

### 方案 C：整体推倒重写
- 优点：最干净
- 缺点：一次性风险过大，现有测试和功能资产浪费严重

**采用方案 B。**

## 3. 目标架构

### 3.1 分层

1. **Runtime 层**  
   统一构造 session resolver、transport、logger、API inventory、Educoder client。

2. **Auth 层**  
   负责：
   - Edge 复用
   - 临时登录兜底
   - 会话缓存
   - 真实会话校验

3. **API Adapter 层**  
   负责所有 `/api/...` 交互，保持 endpoint purpose 清晰、输入输出明确。

4. **Domain / Workspace 层**  
   负责：
   - collection manifest
   - task hydration
   - repository / history / answer / template / passed 等材料落盘

5. **UI / Command 层**  
   只做用户入口和结果呈现，不再自己拼装底层依赖。

6. **Recon / Observability 层**  
   负责：
   - 统一 HTTP trace
   - API inventory
   - 页面快照
   - 后续隐藏接口发现

### 3.2 数据结构原则

- manifest 保持“稳定 ID + 可读名称”双轨；
- request trace 与 endpoint summary 分离：
  - trace = 每次调用
  - inventory = 聚合后的接口表
- auth/session 只暴露最小必要字段，不在日志中泄漏 cookie。

## 4. 文档重建策略

本轮将文档收敛到 5 个核心文件：

- `agent.md`
- `docs/plans/2026-04-04-educoder-rebuild-design.md`
- `docs/plans/2026-04-04-educoder-rebuild.md`
- `docs/reference/project-record.md`
- `docs/reference/api-inventory.md`

旧文档保留作为历史材料，但后续实现只更新以上 canonical docs。

## 5. 分阶段实施

### Phase 1：基础设施净化
- 提取 shared runtime
- 加入真实 session validator
- 加入 transport trace 与 API inventory
- 重写 canonical docs

### Phase 2：认证与同步链路修复
- 默认 Edge 复用
- 登录失败诊断更清晰
- collection sync / task hydration 统一走 shared runtime

### Phase 3：侦察与隐藏接口
- 静态接口清单
- 运行时请求采集
- 页面/JS bundle 继续深挖隐藏接口

### Phase 4：收尾与交付
- 全量测试、typecheck、build
- 重新生成 `dist/`
- 打包 VSIX

## 6. 设计结论

这次不是“加功能”，而是先把项目整理成**可以稳定迭代的产品骨架**：

- 共享 runtime 负责一切底层依赖；
- auth 不再做弱校验；
- transport 统一可观测；
- 文档从分散说明变成操作手册 + 项目记录；
- 隐藏接口发现能力内建，而不是靠临时排查。
