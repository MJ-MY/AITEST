import { NextResponse } from "next/server";
import { buildChatSystemPrompt, CHAT_MODEL } from "@/lib/chat-model";

/** 与上游 MiniMax 请求超时一致（毫秒） */
const UPSTREAM_TIMEOUT_MS = 180_000;

/** 部署在 Vercel 时可放宽（视套餐而定） */
export const maxDuration = 300;

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

/** 禁止误用 Anthropic 专用地址（与 OpenAI 兼容接口不同） */
function assertOpenAiCompatibleBaseUrl(base: string) {
  const lower = base.toLowerCase();
  if (lower.includes("/anthropic")) {
    throw new Error(
      "MINIMAX_BASE_URL 不能带 /anthropic。本应用走 OpenAI 兼容接口，请使用：https://api.minimaxi.com/v1 或 https://api.minimax.io/v1",
    );
  }
}

function abortSignal(): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), UPSTREAM_TIMEOUT_MS);
  return c.signal;
}

function ndjsonHeaders() {
  return {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  } as const;
}

function responseFromFullText(text: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const t = text ?? "";
      if (t) controller.enqueue(encoder.encode(`${JSON.stringify({ t })}\n`));
      controller.enqueue(encoder.encode(`${JSON.stringify({ done: true })}\n`));
      controller.close();
    },
  });
  return new Response(stream, { headers: ndjsonHeaders() });
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function postChatCompletionsJson(args: {
  baseURL: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  stream: boolean;
}): Promise<Response> {
  const { baseURL, apiKey, model, messages, stream } = args;
  const url = `${baseURL}/chat/completions`;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 1,
      stream,
    }),
    signal: abortSignal(),
  });
}

async function readNonStreamContent(res: Response): Promise<string> {
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (data.error?.message) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content ?? "";
}

function parseSseLine(line: string): { text?: string; done?: boolean; error?: string } {
  const s = line.trim();
  if (!s || s.startsWith(":")) return {};
  if (!s.startsWith("data:")) return {};
  const payload = s.slice(5).trim();
  if (payload === "[DONE]") return { done: true };
  try {
    const j = JSON.parse(payload) as {
      choices?: { delta?: { content?: string } }[];
      error?: { message?: string };
    };
    if (j.error?.message) return { error: j.error.message };
    const piece = j.choices?.[0]?.delta?.content;
    if (typeof piece === "string" && piece.length > 0) return { text: piece };
    return {};
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  const rawBase = process.env.MINIMAX_BASE_URL?.trim() ?? "https://api.minimax.io/v1";
  let baseURL: string;
  try {
    baseURL = normalizeBaseUrl(rawBase);
    assertOpenAiCompatibleBaseUrl(baseURL);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "MINIMAX_BASE_URL 无效" },
      { status: 400 },
    );
  }

  const preferStream =
    process.env.MINIMAX_STREAM !== "false" && process.env.MINIMAX_STREAM !== "0";

  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置 MINIMAX_API_KEY，请在 .env.local 中设置。" },
      { status: 500 },
    );
  }

  let body: { messages: { role: string; content: string }[]; model?: string; deepThinking?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const { messages, model, deepThinking } = body;
  if (!messages?.length) {
    return NextResponse.json({ error: "messages 不能为空" }, { status: 400 });
  }

  const modelId = model ?? CHAT_MODEL;
  const systemContent = buildChatSystemPrompt(modelId, Boolean(deepThinking));

  const fullMessages: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const runNonStream = async () => {
    const res = await postChatCompletionsJson({
      baseURL,
      apiKey,
      model: modelId,
      messages: fullMessages,
      stream: false,
    });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = (await res.json()) as { error?: { message?: string } };
        if (j.error?.message) msg = j.error.message;
      } catch {
        /* ignore */
      }
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return readNonStreamContent(res);
  };

  if (!preferStream) {
    try {
      const text = await runNonStream();
      return responseFromFullText(text);
    } catch (e: unknown) {
      return NextResponse.json({ error: formatFetchError(e) }, { status: 502 });
    }
  }

  let upstream: Response;
  try {
    upstream = await postChatCompletionsJson({
      baseURL,
      apiKey,
      model: modelId,
      messages: fullMessages,
      stream: true,
    });
  } catch (e: unknown) {
    try {
      const text = await runNonStream();
      return responseFromFullText(text);
    } catch {
      return NextResponse.json({ error: formatFetchError(e) }, { status: 502 });
    }
  }

  if (!upstream.ok) {
    let msg = upstream.statusText;
    try {
      const j = (await upstream.json()) as { error?: { message?: string } };
      if (j.error?.message) msg = j.error.message;
    } catch {
      /* ignore */
    }
    try {
      const text = await runNonStream();
      return responseFromFullText(text);
    } catch {
      return NextResponse.json({ error: msg || `HTTP ${upstream.status}` }, { status: 502 });
    }
  }

  if (!upstream.body) {
    return NextResponse.json({ error: "上游未返回响应体" }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const out = new ReadableStream({
    async start(controller) {
      const push = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };

      const reader = upstream.body!.getReader();
      const dec = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (value) buffer += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) >= 0) {
            const rawLine = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            const line = rawLine.replace(/\r$/, "");
            const parsed = parseSseLine(line);
            if (parsed.error) {
              push({ error: parsed.error });
              return;
            }
            if (parsed.done) {
              push({ done: true });
              return;
            }
            if (parsed.text) push({ t: parsed.text });
          }
          if (done) break;
        }
        const tail = buffer.trim();
        if (tail) {
          const parsed = parseSseLine(tail);
          if (parsed.error) {
            push({ error: parsed.error });
            return;
          }
          if (parsed.text) push({ t: parsed.text });
        }
        push({ done: true });
      } catch (e: unknown) {
        try {
          const text = await runNonStream();
          if (text) push({ t: text });
          push({ done: true });
        } catch {
          push({ error: e instanceof Error ? e.message : "流式读取失败" });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(out, { headers: ndjsonHeaders() });
}

function formatFetchError(e: unknown): string {
  const message = e instanceof Error ? e.message : "模型请求失败";
  if (message.includes("AbortError") || message.toLowerCase().includes("timeout")) {
    return `${message}（超过 ${UPSTREAM_TIMEOUT_MS / 1000}s）`;
  }
  return message;
}
