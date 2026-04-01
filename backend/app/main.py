import asyncio
import json
import os
from contextlib import contextmanager
from threading import Thread
from typing import Any, AsyncIterator, Optional, cast

import dashscope
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .settings import settings


app = FastAPI(title=settings.app_name)


@app.get("/health")
def health():
    return {"ok": True, "env": settings.environment}


@contextmanager
def _no_proxy_env():
    keys = [
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "NO_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
        "no_proxy",
        "SOCKS_PROXY",
        "SOCKS5_PROXY",
        "socks_proxy",
        "socks5_proxy",
    ]
    old = {k: os.environ.get(k) for k in keys if k in os.environ}
    for k in keys:
        os.environ.pop(k, None)
    try:
        yield
    finally:
        for k in keys:
            os.environ.pop(k, None)
        os.environ.update(old)


def ndjson_headers() -> dict[str, str]:
    return {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
    }


async def response_from_full_text_ndjson(text: str) -> AsyncIterator[str]:
    t = text or ""
    if t:
        yield json.dumps({"t": t}, ensure_ascii=False) + "\n"
    yield json.dumps({"done": True}, ensure_ascii=False) + "\n"


class ChatMessage(BaseModel):
    role: str = Field(..., description="system/user/assistant")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    # 前端会传 model（之前是 MiniMax 的 model id）。现在我们复用它来传 Qwen 的模型名。
    # 例如：qwen-plus / qwen-turbo 等。没传则默认 qwen-plus。
    model: Optional[str] = None


def _extract_qwen_text_delta(evt: Any) -> str | None:
    # DashScope 事件结构在不同版本/参数下会略有差异，这里尽量兼容多种形态。
    try:
        msg = evt.output.choices[0].message  # type: ignore[attr-defined]
        content = getattr(msg, "content", None)
        if isinstance(content, str) and content:
            return content
    except Exception:
        pass

    try:
        delta = evt.output.choices[0].delta  # type: ignore[attr-defined]
        content = getattr(delta, "content", None)
        if isinstance(content, str) and content:
            return content
    except Exception:
        pass

    raw = evt if isinstance(evt, dict) else getattr(evt, "__dict__", None)
    if isinstance(raw, dict):
        output = cast(dict[str, Any], raw.get("output") or {})
        choices = cast(list[Any], output.get("choices") or [])
        if choices:
            c0 = cast(dict[str, Any], choices[0] or {})
            msg = cast(dict[str, Any], c0.get("message") or {})
            content = msg.get("content")
            if isinstance(content, str) and content:
                return content
            delta = cast(dict[str, Any], c0.get("delta") or {})
            content = delta.get("content")
            if isinstance(content, str) and content:
                return content
    return None


async def response_from_qwen_stream_ndjson(messages: list[dict[str, str]], model: str) -> AsyncIterator[str]:
    """
    上游 DashScope 流式（stream=True），下游仍输出 NDJSON（{"t": "..."} / {"done": true}）。
    """
    api_key = (settings.DASHSCOPE_API_KEY or "").strip() or None
    q: asyncio.Queue[tuple[str, str]] = asyncio.Queue()

    def _worker() -> None:
        try:
            with _no_proxy_env():
                stream = dashscope.Generation.call(
                    api_key=api_key,
                    model=model,
                    messages=messages,
                    enable_thinking=True,  # 深度思考
                    stream=True,
                    incremental_output=True,
                    logprobs=True,  # 对数概率
                    enable_search=True,  # 联网搜索
                    result_format="message",
                )
                last_text = ""
                for evt in stream:
                    piece = _extract_qwen_text_delta(evt)
                    if not piece:
                        continue
                    # incremental_output 可能返回“累计文本”，这里转成 delta 再下发
                    if piece.startswith(last_text):
                        delta = piece[len(last_text) :]
                        last_text = piece
                    else:
                        delta = piece
                        last_text = last_text + piece
                    if delta:
                        q.put_nowait(("t", delta))
        except Exception as e:  # noqa: BLE001
            q.put_nowait(("error", str(e)))
        finally:
            q.put_nowait(("done", "1"))

    Thread(target=_worker, daemon=True).start()

    while True:
        kind, payload = await q.get()
        if kind == "t":
            yield json.dumps({"t": payload}, ensure_ascii=False) + "\n"
        elif kind == "error":
            yield json.dumps({"error": payload}, ensure_ascii=False) + "\n"
        elif kind == "done":
            yield json.dumps({"done": True}, ensure_ascii=False) + "\n"
            return


@app.post("/v1/chat")
async def chat_v1(body: ChatRequest):
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages 不能为空")

    api_key = (settings.DASHSCOPE_API_KEY or "").strip()
    if not api_key:
        async def gen_missing_key() -> AsyncIterator[str]:
            yield json.dumps({"error": "未配置 DASHSCOPE_API_KEY，请在 .env.local 中设置。"}, ensure_ascii=False) + "\n"
            yield json.dumps({"done": True}, ensure_ascii=False) + "\n"

        return StreamingResponse(gen_missing_key(), headers=ndjson_headers())

    model = (body.model or "qwen-plus").strip() or "qwen-plus"
    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    async def gen() -> AsyncIterator[str]:
        try:
            async for chunk in response_from_qwen_stream_ndjson(messages, model=model):
                yield chunk
        except Exception as e:  # noqa: BLE001
            yield json.dumps({"error": str(e)}, ensure_ascii=False) + "\n"
            yield json.dumps({"done": True}, ensure_ascii=False) + "\n"

    return StreamingResponse(gen(), headers=ndjson_headers())

