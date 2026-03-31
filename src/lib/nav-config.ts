import type { LucideIcon } from "lucide-react";
import { Image as ImageIcon, MessageSquare } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** 左侧主导航：切换右侧内容区 */
export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "智能对话", icon: MessageSquare },
  { href: "/image", label: "AI 配图", icon: ImageIcon },
];

const TITLE_MAP: Record<string, string> = Object.fromEntries(MAIN_NAV.map((n) => [n.href, n.label]));

/** 顶栏标题：非对话页用菜单名；对话页由 AppHeader 结合会话标题处理 */
export function getStaticPageTitle(pathname: string): string | null {
  if (pathname === "/") return null;
  return TITLE_MAP[pathname] ?? "AI小博士";
}
