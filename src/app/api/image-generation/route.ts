import { NextResponse } from "next/server";
import { IMAGE_GEN_MODEL, type ImageAspectRatio } from "@/lib/image-generation";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

type MiniMaxImageResp = {
  id?: string;
  data?: {
    image_urls?: string[];
    image_base64?: string[];
  };
  metadata?: { success_count?: number | string; failed_count?: number | string };
  base_resp?: { status_code?: number; status_msg?: string };
};

export async function POST(req: Request) {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  const rawBase = process.env.MINIMAX_BASE_URL?.trim() ?? "https://api.minimax.io/v1";
  const baseURL = normalizeBaseUrl(rawBase);

  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置 MINIMAX_API_KEY，请在 .env.local 中设置。" },
      { status: 500 },
    );
  }

  let body: {
    prompt?: string;
    aspect_ratio?: ImageAspectRatio;
    n?: number;
    response_format?: "url" | "base64";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt 不能为空" }, { status: 400 });
  }
  if (prompt.length > 1500) {
    return NextResponse.json({ error: "描述过长，请控制在 1500 字以内" }, { status: 400 });
  }

  const n = Math.min(9, Math.max(1, body.n ?? 1));
  const aspect_ratio = body.aspect_ratio ?? "1:1";
  const response_format = body.response_format ?? "url";

  const url = `${baseURL}/image_generation`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: IMAGE_GEN_MODEL,
        prompt,
        aspect_ratio,
        n,
        response_format,
        prompt_optimizer: true,
      }),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "请求失败" },
      { status: 502 },
    );
  }

  const data = (await res.json()) as MiniMaxImageResp;
  const code = data.base_resp?.status_code;
  const msg = data.base_resp?.status_msg ?? "生成失败";

  if (!res.ok || (code !== undefined && code !== 0)) {
    return NextResponse.json(
      { error: msg || `HTTP ${res.status}`, code: code ?? res.status },
      { status: 502 },
    );
  }

  if (response_format === "base64") {
    const raw = data.data?.image_base64 ?? [];
    const images = raw.map((b64) => `data:image/png;base64,${b64}`);
    return NextResponse.json({
      images,
      format: "base64" as const,
      id: data.id,
      metadata: data.metadata,
    });
  }

  const images = data.data?.image_urls ?? [];
  if (images.length === 0) {
    return NextResponse.json({ error: "未返回图片地址", code }, { status: 502 });
  }

  return NextResponse.json({
    images,
    format: "url" as const,
    id: data.id,
    metadata: data.metadata,
  });
}
