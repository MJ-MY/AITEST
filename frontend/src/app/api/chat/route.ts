import { NextResponse } from "next/server";

/** 部署在 Vercel 时可放宽（视套餐而定） */
export const maxDuration = 300;

const pythonApiOrigin = process.env.PY_API_ORIGIN ?? "http://localhost:8000";

export async function POST(req: Request) {
  const body = await req.text();
  const upstream = await fetch(`${pythonApiOrigin}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": req.headers.get("content-type") ?? "application/json",
    },
    body,
  });

  // 直接透传响应流（前端按 NDJSON 逐行解析）
  const headers = new Headers(upstream.headers);
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

