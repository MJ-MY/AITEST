"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthModal } from "@/contexts/auth-modal-context";
import { useAppStore } from "@/store/use-app-store";

export function AppHeader() {
  const { openLogin } = useAuthModal();
  const isLoggedIn = useAppStore((s) => s.isLoggedIn);
  const logout = useAppStore((s) => s.logout);

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);

  const sessionReady = hasMounted && isLoggedIn;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <h1 className="truncate text-base font-semibold text-foreground lg:text-lg">AI小博士</h1>
      <div className="flex items-center gap-2">
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

