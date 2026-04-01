"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthModal } from "@/contexts/auth-modal-context";
import { CHAT_MODEL } from "@/lib/chat-model";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/use-app-store";

export function ChatApp() {
  const { openLogin } = useAuthModal();
  const isLoggedIn = useAppStore((s) => s.isLoggedIn);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const addOrCreateUserMessage = useAppStore((s) => s.addOrCreateUserMessage);
  const addAssistantMessage = useAppStore((s) => s.addAssistantMessage);
  const getActiveConversation = useAppStore((s) => s.getActiveConversation);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);

  const active = hasMounted ? getActiveConversation() : undefined;
  const sessionReady = hasMounted && isLoggedIn;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages?.length, activeConversationId, streamingReply, sending]);

  const handleSend = async () => {
    if (!isLoggedIn) {
      openLogin();
      return;
    }
    const text = input.trim();
    if (!text || sending) return;

    setSendError(null);
    setStreamingReply("");
    setSending(true);
    const prevActive = activeConversationId;
    const convId = addOrCreateUserMessage(prevActive, text);
    setInput("");

    const { conversations: latest } = useAppStore.getState();
    const c = latest.find((x) => x.id === convId);
    const msgs = c?.messages.map((m) => ({ role: m.role, content: m.content })) ?? [];

    const abort = new AbortController();
    const clientTimeoutMs = 185_000;
    const timeoutId = window.setTimeout(() => abort.abort(), clientTimeoutMs);

    const parseSseData = (s: string) => {
      let o: { t?: string; done?: boolean; error?: string; ok?: boolean };
      try {
        o = JSON.parse(s) as { t?: string; done?: boolean; error?: string; ok?: boolean };
      } catch {
        throw new Error("响应解析失败，请重试");
      }
      if (o.error) throw new Error(o.error);
      return o;
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgs,
          model: CHAT_MODEL,
        }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `请求失败 (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const dec = new TextDecoder();
      let buffer = "";
      let full = "";

      const flushEvents = () => {
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const rawEvt = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);

          const lines = rawEvt.split("\n");
          let eventName = "message";
          const dataParts: string[] = [];
          for (const line of lines) {
            if (!line) continue;
            if (line.startsWith(":")) continue; // comment/keep-alive
            if (line.startsWith("event:")) {
              eventName = line.slice("event:".length).trim() || "message";
            } else if (line.startsWith("data:")) {
              dataParts.push(line.slice("data:".length).trimStart());
            }
          }

          const dataRaw = dataParts.join("\n").trim();
          if (!dataRaw) continue;
          const o = parseSseData(dataRaw);

          if (o.t) {
            full += o.t;
            setStreamingReply(full);
          }
          if (eventName === "done" || o.done) return true;
        }
        return false;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (value) buffer += dec.decode(value, { stream: true });
        const shouldStop = flushEvents();
        if (shouldStop) break;
        if (done) break;
      }

      // 容错：没有以 \n\n 结尾的最后一帧
      if (buffer.trim()) {
        buffer += "\n\n";
        flushEvents();
      }

      if (full.trim()) {
        addAssistantMessage(convId, full);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setSendError(`请求超过 ${clientTimeoutMs / 1000} 秒未结束，已取消。可缩短问题后重试。`);
      } else {
        setSendError(err instanceof Error ? err.message : "发送失败");
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSending(false);
      setStreamingReply("");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-6"
        role="log"
        aria-label="对话内容"
      >
        <div className="mx-auto max-w-3xl space-y-4 pb-4">
          {!active || active.messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-muted-foreground">
              <Bot className="mx-auto mb-3 h-10 w-10 text-primary/80" />
              <p className="text-base text-foreground">你好，我是 AI小博士</p>
              <p className="mt-2 text-sm">可以直接输入问题开始对话；首次发送会自动加入历史对话。</p>
            </div>
          ) : null}

          {active?.messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                  m.role === "user"
                    ? "bg-violet-100 text-violet-950 dark:bg-violet-950/40 dark:text-violet-50"
                    : "border border-border bg-card text-card-foreground",
                )}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-card-foreground shadow-sm">
                <p className="whitespace-pre-wrap">
                  {streamingReply || <span className="text-muted-foreground">正在生成回复…</span>}
                  {streamingReply ? (
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-middle" />
                  ) : null}
                </p>
              </div>
            </div>
          )}
          {sendError ? <p className="text-center text-sm text-destructive">{sendError}</p> : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card/80 px-4 pb-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto max-w-3xl">
          <div className="flex h-chat max-h-chat flex-col overflow-hidden rounded-2xl border-2 border-primary/30 bg-background p-2 shadow-sm">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="输入消息，Enter 发送，Shift+Enter 换行"
              disabled={!sessionReady || sending}
              className="min-h-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-0.5 py-1 text-sm leading-relaxed focus-visible:ring-0 sm:text-base"
            />
            <div className="mt-1 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-9 items-center rounded-full border border-border bg-muted/40 px-3 text-xs text-muted-foreground">
                  {CHAT_MODEL}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={!sessionReady || sending || !input.trim()}
                  type="button"
                  onClick={() => void handleSend()}
                  aria-label={sending ? "生成中" : "发送"}
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

