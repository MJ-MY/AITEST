# 后端说明（FastAPI + 通义千问）

## 技术栈

- **框架**：FastAPI + Uvicorn  
- **大模型**：阿里云 **DashScope**（通义千问），通过 `dashscope` Python SDK 调用 `Generation.call`  
- **配置**：`pydantic-settings` + 从 `backend/.env.local` / `backend/.env` 加载（见 `app/settings.py`）

## 目录结构（核心）

```
backend/
├── requirements.txt      # Python 依赖
├── app/
│   ├── main.py           # 路由：/health、/v1/chat
│   └── settings.py       # 环境变量与默认值
```

## 对外接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查，返回 `{"ok": true, "env": "..."}` |
| POST | `/v1/chat` | 对话：请求体为 JSON，见下；响应为 **NDJSON**（每行一个 JSON） |

### POST `/v1/chat` 请求体

```json
{
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "model": "qwen-plus"
}
```

- `model` 可选，默认 `qwen-plus`；可换为其它千问模型名（以 DashScope 文档为准）。

### 响应格式（NDJSON，与前端 `chat-app` 解析一致）

- 正常：`{"t":"片段"}\n` 多行，最后 `{"done":true}\n`  
- 当前实现为：**先拿到千问完整回复**，再拆成一行 `t` + 一行 `done`（便于统一前端协议）。  
- 未配置 Key 或出错时：可能输出 `{"error":"..."}\n` 与 `{"done":true}\n`。

## 环境变量

在 **`backend/.env`**（或 `backend/.env.local`）中配置（后端启动时会 `load_dotenv` 读入）：

| 变量 | 必填 | 说明 |
|------|------|------|
| `DASHSCOPE_API_KEY` | 是 | 阿里云百炼 / DashScope API Key |

示例见 `backend/.env.example`。

## 本地运行

**重要**：`uvicorn backend.app.main:app` 里的 `backend` 是 **Python 包名**，必须在**仓库根目录**（`AITEST/`）下执行，这样 `sys.path` 里才有名为 `backend` 的包。若在 `backend/` 子目录里启动，请改用下面的「方式 B」。

**方式 A（推荐，在仓库根目录）**

```bash
cd /path/to/AITEST
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
backend/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

**方式 B（当前目录已是 `backend/`）**

```bash
cd backend
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

确认：`curl http://127.0.0.1:8000/health`

## 与 Next.js 的关系

- 前端通过 **`PY_API_ORIGIN`**（默认 `http://localhost:8000`）访问本服务。  
- 实际聊天请求路径：浏览器 → `POST /api/chat`（Next Route Handler）→ 转发到 `POST {PY_API_ORIGIN}/v1/chat`。

## 生产部署提示

- 将 `DASHSCOPE_API_KEY` 配在运行环境或密钥管理，勿提交到 Git。  
- 将 FastAPI 与 Next 分别部署；Next 侧设置 `PY_API_ORIGIN` 为线上 API 根地址（如 `https://api.yourdomain.com`）。
