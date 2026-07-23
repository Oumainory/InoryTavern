import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { LinkButton } from "@/components/ui/link-button";
import { Sparkles } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "InoryTavern · AI 角色扮演酒馆",
  description: "一个开源的 AI 角色扮演聊天酒馆",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-14 items-center justify-between px-4">
              <div className="flex items-center gap-6">
                <LinkButton
                  href="/"
                  variant="ghost"
                  className="text-base font-heading font-semibold tracking-tight px-2"
                >
                  <Sparkles className="size-4 text-primary" />
                  InoryTavern
                </LinkButton>
                <nav className="flex items-center gap-4 text-sm text-muted-foreground">
                  <LinkButton
                    href="/"
                    variant="link"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    角色
                  </LinkButton>
                  <LinkButton
                    href="/create"
                    variant="link"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    创角
                  </LinkButton>
                  <LinkButton
                    href="/settings"
                    variant="link"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ⚙️ 设置
                  </LinkButton>
                </nav>
              </div>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
