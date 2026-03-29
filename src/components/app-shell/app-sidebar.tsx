"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, Clock, Menu, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { MAIN_NAV } from "@/lib/nav-config";
import type { Conversation } from "@/store/use-app-store";
import { useAppStore } from "@/store/use-app-store";

type AppSidebarProps = {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

export function AppSidebar({ mobileOpen, onMobileOpenChange }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const startNewChat = useAppStore((s) => s.startNewChat);
  const setActiveConversation = useAppStore((s) => s.setActiveConversation);
  const conversations = useAppStore((s) => s.conversations);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const deleteConversation = useAppStore((s) => s.deleteConversation);

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);

  const sortedHistory = hasMounted
    ? [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
    : [];

  const handleNewChat = () => {
    startNewChat();
    router.push("/");
    onMobileOpenChange(false);
  };

  const handleSelectHistory = (id: string) => {
    setActiveConversation(id);
    router.push("/");
    onMobileOpenChange(false);
  };

  const inner = (
    <SidebarInner
      pathname={pathname}
      onNewChat={handleNewChat}
      sortedHistory={sortedHistory}
      activeConversationId={activeConversationId}
      onSelectHistory={handleSelectHistory}
      onDelete={deleteConversation}
    />
  );

  return (
    <>
      <div className="fixed left-3 top-3 z-40 lg:hidden">
        <Button
          variant="outline"
          size="icon"
          className="bg-card shadow-sm"
          onClick={() => onMobileOpenChange(true)}
          aria-label="打开菜单"
          type="button"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <aside className="hidden h-screen w-[260px] shrink-0 flex-col border-r border-border bg-[hsl(0_0%_99%)] lg:flex">
        {inner}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="关闭菜单"
            onClick={() => onMobileOpenChange(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-[min(280px,85vw)] flex-col overflow-hidden border-r bg-[hsl(0_0%_99%)] shadow-xl">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium">菜单</span>
              <Button variant="ghost" size="icon" type="button" onClick={() => onMobileOpenChange(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            {inner}
          </div>
        </div>
      ) : null}
    </>
  );
}

function SidebarInner({
  pathname,
  onNewChat,
  sortedHistory,
  activeConversationId,
  onSelectHistory,
  onDelete,
}: {
  pathname: string;
  onNewChat: () => void;
  sortedHistory: Conversation[];
  activeConversationId: string | null;
  onSelectHistory: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-foreground">AI小博士</span>
      </div>

      <div className="p-3">
        <Button
          className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          type="button"
          onClick={onNewChat}
        >
          <Plus className="h-5 w-5" />
          开启新会话
        </Button>
      </div>

      <div className="px-3 pb-2">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">功能导航</p>
        <nav className="space-y-1">
          {MAIN_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Separator className="my-2" />

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-4">
        <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          历史对话
        </div>
        <ScrollArea className="h-[calc(100vh-380px)] min-h-[120px]">
          <ul className="space-y-1 pr-2">
            {sortedHistory.length === 0 ? (
              <li className="px-2 py-4 text-center text-xs text-muted-foreground">暂无历史，发送首条消息即可创建</li>
            ) : (
              sortedHistory.map((c) => (
                <li key={c.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectHistory(c.id)}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-sm transition",
                      activeConversationId === c.id && pathname === "/"
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {c.title}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-0 transition group-hover:opacity-100"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c.id);
                    }}
                    aria-label="删除对话"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))
            )}
          </ul>
        </ScrollArea>
      </div>
    </>
  );
}
