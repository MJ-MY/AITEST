"use client";

import { useState } from "react";
import { Download, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthModal } from "@/contexts/auth-modal-context";
import { IMAGE_ASPECT_RATIOS, IMAGE_GEN_MODEL } from "@/lib/image-generation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";

export function ImageGenPage() {
  const { openLogin } = useAuthModal();
  const isLoggedIn = useAppStore((s) => s.isLoggedIn);
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<(typeof IMAGE_ASPECT_RATIOS)[number]>("1:1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);

  const handleGenerate = async () => {
    if (!isLoggedIn) {
      openLogin();
      return;
    }
    const p = prompt.trim();
    if (!p || loading) return;

    setError(null);
    setImages([]);
    setLoading(true);
    try {
      const res = await fetch("/api/image-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: p,
          aspect_ratio: aspect,
          n: 1,
          response_format: "url",
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        images?: string[];
      };
      if (!res.ok) {
        throw new Error(data.error ?? `请求失败 (${res.status})`);
      }
      if (data.images?.length) setImages(data.images);
      else throw new Error("未返回图片");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">文生图（MiniMax {IMAGE_GEN_MODEL}）</p>
              <p className="mt-1">
                用自然语言描述画面，例如「一只金毛幼犬坐在草地上，阳光柔和，摄影风格」。与智能对话不同，配图走独立接口{" "}
                <code className="rounded bg-muted px-1 text-xs">/v1/image_generation</code>。
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">画面描述</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：一只可爱的小狗，卡通风格，白色背景"
              className="min-h-[120px] resize-y text-base"
              disabled={loading}
            />
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">比例</span>
              <select
                value={aspect}
                onChange={(e) => setAspect(e.target.value as (typeof IMAGE_ASPECT_RATIOS)[number])}
                disabled={loading}
                className={cn(
                  "h-9 rounded-md border border-input bg-background px-3 text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                {IMAGE_ASPECT_RATIOS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">（链接约 24 小时内有效）</span>
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto"
              size="lg"
              disabled={loading || !prompt.trim()}
              onClick={() => void handleGenerate()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  生成中…
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-5 w-5" />
                  生成图片
                </>
              )}
            </Button>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {images.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">生成结果</p>
              <div className="grid gap-4 sm:grid-cols-1">
                {images.map((src, i) => (
                  <figure
                    key={`${src}-${i}`}
                    className="overflow-hidden rounded-2xl border border-border bg-muted/30 shadow-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`生成图 ${i + 1}`} className="h-auto w-full object-contain" />
                    <figcaption className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
                      <a
                        href={src}
                        download={`minimax-image-${i + 1}.png`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        打开 / 另存
                      </a>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
