"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStaticPageTitle } from "@/lib/nav-config";
import { useAuthModal } from "@/contexts/auth-modal-context";
import { useAppStore } from "@/store/use-app-store";

export function AppHeader() {
  const pathname = usePathname();
  const { openLogin } = useAuthModal();
  const isLoggedIn = useAppStore((s) => s.isLoggedIn);
  const logout = useAppStore((s) => s.logout);
  const getActiveConversation = useAppStore((s) => s.getActiveConversation);

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);

  const staticTitle = getStaticPageTitle(pathname);
  const active = hasMounted ? getActiveConversation() : undefined;
  const chatTitle = active?.title ?? "新对话";
  const title = pathname === "/" ? chatTitle : (staticTitle ?? "AI小博士");

  const sessionReady = hasMounted && isLoggedIn;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 pl-14 lg:pl-4">
      <h1 className="truncate text-base font-semibold text-foreground lg:text-lg">{title}</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="通知" type="button">
          <Bell className="h-5 w-5" />
        </Button>
        {sessionReady ? (
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5">
            <User className="h-4 w-4 text-primary" />
            <span className="hidden text-sm sm:inline">admin</span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" type="button" onClick={() => logout()}>
              退出
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" type="button" onClick={() => openLogin()}>
            请登录
          </Button>
        )}
      </div>
    </header>
  );
}
