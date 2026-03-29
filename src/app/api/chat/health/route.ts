import { NextResponse } from "next/server";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export async function GET() {
  const baseURL = normalizeBaseUrl(
    process.env.MINIMAX_BASE_URL?.trim() ?? "https://api.minimax.io/v1",
  );
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(`${baseURL}/models`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return NextResponse.json({
      ok: true,
      baseURL,
      upstreamStatus: res.status,
    });
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, baseURL, error: msg },
      { status: 503 },
    );
  }
}
