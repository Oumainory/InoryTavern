// 客户端聊天工作区：左侧历史会话 + 右侧聊天
// 移动端：左侧抽屉用 Sheet 唤起
// 桌面端：左侧平铺侧边栏
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChatView } from "@/components/chat-view";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/link-button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  Loader2,
  MessageSquarePlus,
  MessageSquareText,
  Trash2,
} from "lucide-react";
import type { CharacterDTO, ChatMessage, ChatSummaryDTO } from "@/lib/types";

export function ChatWorkspace({
  character,
  currentChatId,
  initialMessages,
  initialChats,
}: {
  character: CharacterDTO;
  currentChatId: string;
  initialMessages: ChatMessage[];
  initialChats: ChatSummaryDTO[];
}) {
  const router = useRouter();
  const [chats, setChats] = useState<ChatSummaryDTO[]>(initialChats);
  const [creating, setCreating] = useState(false);
  // 移动端 Sheet 状态
  const [sheetOpen, setSheetOpen] = useState(false);

  // 切回当前页面时刷新侧栏
  const refreshChats = useCallback(async () => {
    try {
      const r = await fetch(`/api/characters/${character.id}/chats`, {
        cache: "no-store",
      });
      if (r.ok) {
        const list: ChatSummaryDTO[] = await r.json();
        setChats(list);
      }
    } catch {
      // 忽略
    }
  }, [character.id]);

  useEffect(() => {
    refreshChats();
  }, [refreshChats, currentChatId]);

  const onNewChat = async () => {
    setCreating(true);
    try {
      const r = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id }),
      });
      if (!r.ok) throw new Error("创建失败");
      const data = await r.json();
      setSheetOpen(false); // 移动端：创建后顺手关闭 Sheet
      router.push(`/chat/${character.id}/${data.id}`);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const onDeleteChat = async (chatId: string) => {
    if (!confirm("确定删除该会话？此操作无法恢复。")) return;
    try {
      const r = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("删除失败");
      // 如果删的是当前会话，跳转到该角色的最新会话（让其重定向到新的最新）
      if (chatId === currentChatId) {
        setSheetOpen(false);
        router.push(`/chat/${character.id}`);
        router.refresh();
      } else {
        await refreshChats();
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // 切换会话（点击侧栏 / 抽屉里的某一项）
  const onSelectChat = (chatId: string) => {
    if (chatId !== currentChatId) {
      setSheetOpen(false); // 移动端：切换后关闭 Sheet
      router.push(`/chat/${character.id}/${chatId}`);
    }
  };

  // 提取的角色头部（侧栏 & Sheet 共用）
  const CharacterHeader = ({ onClose }: { onClose?: () => void }) => (
    <div className="p-3 border-b border-border/60 space-y-2">
      {onClose && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="md:hidden self-start"
          onClick={onClose}
          aria-label="关闭"
        >
          <ArrowLeft className="size-4" />
        </Button>
      )}
      <LinkButton
        href="/"
        variant="ghost"
        size="sm"
        className="self-start w-full justify-start"
      >
        <ArrowLeft className="size-3.5" />
        返回角色列表
      </LinkButton>
      <div className="flex items-center gap-2">
        <div className="size-9 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 via-accent/30 to-secondary/40 shrink-0 flex items-center justify-center text-sm font-heading text-foreground/70">
          {character.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.avatar}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            character.name.slice(0, 1)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-heading font-semibold truncate flex items-center gap-1">
            {character.name}
            {character.isNsfw && (
              <span className="rounded-full bg-destructive/90 text-destructive-foreground px-1 py-0 text-[9px] font-medium uppercase">
                NSFW
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {character.description}
          </div>
        </div>
      </div>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="w-full"
        onClick={onNewChat}
        disabled={creating}
      >
        {creating ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <MessageSquarePlus className="size-4" />
        )}
        新建对话
      </Button>
    </div>
  );

  // 提取的会话列表（侧栏 & Sheet 共用）
  const ChatsList = () => (
    <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
      <div className="text-xs text-muted-foreground px-2 py-1">
        历史会话（{chats.length}）
      </div>
      {chats.length === 0 && (
        <div className="text-xs text-muted-foreground px-2 py-3 text-center">
          还没有会话
        </div>
      )}
      {chats.map((c) => {
        const active = c.id === currentChatId;
        return (
          <div
            key={c.id}
            className={cn(
              "group/chat flex items-start gap-1 rounded-lg p-2 cursor-pointer hover:bg-muted/60 transition-colors",
              active && "bg-muted"
            )}
            onClick={() => onSelectChat(c.id)}
          >
            <MessageSquareText className="size-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "text-sm truncate",
                  active && "font-medium"
                )}
              >
                {c.title}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                {/* 国际化时间格式在 SSR 和浏览器可能不一致（toLocaleString 依赖 locale），
                    用 suppressHydrationWarning 抑制警告即可，UI 不会有任何可感知差异 */}
                <span suppressHydrationWarning>
                  {new Date(c.createdAt).toLocaleString()}
                </span>
                <span>·</span>
                <span>{c.messageCount} 条</span>
              </div>
            </div>
            <button
              type="button"
              aria-label="删除会话"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChat(c.id);
              }}
              className="opacity-100 md:opacity-0 md:group-hover/chat:opacity-100 size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center shrink-0"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[20%_80%] gap-0 h-full">
      {/* 桌面端：左侧平铺侧边栏 */}
      <aside className="hidden md:flex flex-col border-r border-border/60 bg-card/30 min-h-0">
        <CharacterHeader />
        <ChatsList />
      </aside>

      {/* 移动端：抽屉式 Sheet（从左滑出） */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="left"
          className="p-0 flex flex-col gap-0"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">历史会话</SheetTitle>
          <CharacterHeader onClose={() => setSheetOpen(false)} />
          <ChatsList />
        </SheetContent>
      </Sheet>

      {/* 右侧：聊天 */}
      <section className="rounded-none md:rounded-xl md:m-3 border border-border bg-card overflow-hidden flex flex-col min-h-0 md:ml-0">
        <ChatView
          character={character}
          chatId={currentChatId}
          initialMessages={initialMessages}
          onMessagesChange={refreshChats}
          onOpenChats={() => setSheetOpen(true)}
        />
      </section>
    </div>
  );
}
