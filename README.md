# Educoder Local OJ Extension

VS Code 扩展雏形：把 Educoder `shixun_homework` 作业集同步到本地，生成可编辑 workspace，并支持本地评测、官方评测缓存与结果查看。

## Frozen MVP Flow

1. 在 Edge 里复制 `https://www.educoder.net/classrooms/.../shixun_homework/...` 链接
2. 运行 `Educoder Local OJ: Sync Current Collection`
3. 打开生成的 task workspace 进行修改
4. 运行 `Educoder Local OJ: Run Local Judge`
5. 运行 `Educoder Local OJ: Run Official Judge`
6. 如需强制重测，运行 `Educoder Local OJ: Force Run Official Judge`

## Local Layout

- `workspace/`：用户本地改题目录
- `_educoder/tests/hidden/`：hidden tests
- `_educoder/logs/remote/`：官方评测原始日志
- `reports/latest_local.json`：本地评测结果
- `reports/latest_remote.json`：官方评测结果

## Development

```bash
npm install
npm test
npm run build
```
