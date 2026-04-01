# 前端说明（Next.js）- 独立项目

## 运行

```bash
cd frontend
npm install
npm run dev -- --port 3000 --hostname 127.0.0.1
```

浏览器打开 `http://127.0.0.1:3000`。

## 环境变量

- `PY_API_ORIGIN`：后端地址，默认 `http://localhost:8000`（写在 `next.config.ts` / `src/app/api/chat/route.ts` 中读取）

示例见 `frontend/.env.example`。

## 请求链路（BFF）

浏览器请求 `POST /api/chat` → Next Route Handler 转发到 `${PY_API_ORIGIN}/v1/chat` → 响应按 **NDJSON** 透传给前端逐行解析。

