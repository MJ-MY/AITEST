"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthModalProvider } from "@/contexts/auth-modal-context";
import { LoginDialog } from "@/components/auth/login-dialog";
import { AppHeader } from "@/components/app-shell/app-header";
import { useAppStore } from "@/store/use-app-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [loginOpen, setLoginOpen] = useState(false);
  const openLogin = useCallback(() => setLoginOpen(true), []);
  const authCtx = useMemo(() => ({ openLogin }), [openLogin]);

  const isLoggedIn = useAppStore((s) => s.isLoggedIn);
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);

  useEffect(() => {
    if (hasMounted && !isLoggedIn) setLoginOpen(true);
  }, [hasMounted, isLoggedIn]);

  const sessionReady = hasMounted && isLoggedIn;

  return (
    <AuthModalProvider value={authCtx}>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[hsl(var(--background))]">
        <AppHeader />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        allowDismissWhenLoggedIn={sessionReady}
      />
    </AuthModalProvider>
  );
}

