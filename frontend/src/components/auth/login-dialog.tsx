"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/store/use-app-store";

type LoginDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 已登录时允许点击遮罩关闭 */
  allowDismissWhenLoggedIn: boolean;
};

export function LoginDialog({ open, onOpenChange, allowDismissWhenLoggedIn }: LoginDialogProps) {
  const login = useAppStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (login(username, password)) {
      onOpenChange(false);
      setUsername("");
      setPassword("");
    } else {
      setLoginError("账号或密码错误");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (!allowDismissWhenLoggedIn) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>登录 AI小博士</DialogTitle>
          <DialogDescription>请先登录后再使用。测试账号：admin / admin123</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-user">账号</Label>
            <Input
              id="login-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-pass">密码</Label>
            <Input
              id="login-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {loginError ? <p className="text-sm text-destructive">{loginError}</p> : null}
          <DialogFooter>
            <Button type="submit" className="w-full sm:w-auto">
              登录
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

