import { NextResponse } from "next/server";
import { isLikelyWeatherQuestion, WEATHER_TOOLS, runWeatherTool } from "@/lib/agent-weather-tools";
import { buildAgentSystemPrompt, CHAT_MODEL } from "@/lib/chat-model";

const UPSTREAM_TIMEOUT_MS = 180_000;
export const maxDuration = 300;

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function assertOpenAiCompatibleBaseUrl(base: string) {
  const lower = base.toLowerCase();
  if (lower.includes("/anthropic")) {
    throw new Error(
      "MINIMAX_BASE_URL 不能带 /anthropic。请使用 OpenAI 兼容地址，例如 https://api.minimax.io/v1",
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

type ToolCall = {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
};

type ChatCompletionMessage = {
  role?: string;
  content?: string | null;
  tool_calls?: ToolCall[];
  reasoning_details?: unknown;
  [key: string]: unknown;
};

type ChatCompletionResp = {
  choices?: {
    message?: ChatCompletionMessage;
    finish_reason?: string;
  }[];
  error?: { message?: string };
  base_resp?: { status_code?: number; status_msg?: string };
};

const MAX_TOOL_ROUNDS = 6;

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

  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置 MINIMAX_API_KEY，请在 .env.local 中设置。" },
      { status: 500 },
    );
  }

  let body: { messages: { role: string; content: string }[]; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const { messages, model } = body;
  if (!messages?.length) {
    return NextResponse.json({ error: "messages 不能为空" }, { status: 400 });
  }

  const modelId = model ?? CHAT_MODEL;
  const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const preferForceWeatherOnFirstTurn = isLikelyWeatherQuestion(lastUserText);

  const fullMessages: Record<string, unknown>[] = [
    { role: "system", content: buildAgentSystemPrompt(modelId) },
    ...messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const url = `${baseURL}/chat/completions`;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    /** 首轮且用户像问天气时，强制调用 get_weather，避免模型用「不能查实时天气」拒答 */
    const toolChoice =
      round === 0 && preferForceWeatherOnFirstTurn
        ? ({ type: "function", function: { name: "get_weather" } } as const)
        : "auto";

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: fullMessages,
          tools: WEATHER_TOOLS,
          tool_choice: toolChoice,
          temperature: 1,
        }),
        signal: abortSignal(),
      });
    } catch (e: unknown) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "请求失败" },
        { status: 502 },
      );
    }

    const data = (await res.json()) as ChatCompletionResp;
    if (!res.ok) {
      const msg = data.error?.message ?? `HTTP ${res.status}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    const code = data.base_resp?.status_code;
    if (code !== undefined && code !== 0) {
      return NextResponse.json(
        { error: data.base_resp?.status_msg ?? "上游错误", code },
        { status: 502 },
      );
    }

    const msg = data.choices?.[0]?.message;
    if (!msg) {
      return NextResponse.json({ error: "模型未返回消息" }, { status: 502 });
    }

    const toolCalls = msg.tool_calls;
    if (toolCalls?.length) {
      // 与 MiniMax 文档一致：下一轮需带回完整 assistant 消息（含 tool_calls、reasoning_details 等）
      const assistantMsg = JSON.parse(JSON.stringify(msg)) as Record<string, unknown>;
      assistantMsg.role = "assistant";
      fullMessages.push(assistantMsg);

      for (const tc of toolCalls) {
        const out = await runWeatherTool(tc.function.name, tc.function.arguments);
        fullMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: out,
        });
      }
      continue;
    }

    const text = typeof msg.content === "string" ? msg.content : "";
    return responseFromFullText(text);
  }

  return NextResponse.json({ error: "工具调用轮数过多，请简化问题" }, { status: 502 });
}
