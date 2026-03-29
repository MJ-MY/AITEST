import { Bot } from "lucide-react";

export function PlaceholderPage({
  title,
  description = "该功能即将上线，敬请期待。",
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <Bot className="h-12 w-12 text-primary/70" />
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
