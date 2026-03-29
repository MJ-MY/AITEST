"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthModalProvider } from "@/contexts/auth-modal-context";
import { LoginDialog } from "@/components/auth/login-dialog";
import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { useAppStore } from "@/store/use-app-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
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
      <div className="flex min-h-screen bg-[hsl(var(--background))]">
        <AppSidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AppHeader />
          <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </div>
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        allowDismissWhenLoggedIn={sessionReady}
      />
    </AuthModalProvider>
  );
}
