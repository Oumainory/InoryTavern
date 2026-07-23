"use client";

// 长期记忆管理组件
// 用法：<MemoryManager characterId={...} />
// 功能：
//   - 顶部：手动添加一条记忆
//   - 列表：按时间倒序展示该角色的所有记忆，支持单条删除
//   - 自动刷新：添加/删除后无需手动 reload
"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Brain, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

type MemoryItem = {
  id: string;
  content: string;
  chatId: string | null;
  createdAt: string;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function MemoryManager({ characterId }: { characterId: string }) {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [newText, setNewText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!characterId) return;
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/memories?characterId=${encodeURIComponent(characterId)}`,
        { cache: "no-store" }
      );
      const json = (await r.json().catch(() => null)) as
        | { data: MemoryItem[] }
        | { error: string }
        | null;
      if (!r.ok || !json || !("data" in json)) {
        const msg =
          (json && "error" in json && json.error) || `加载失败 (${r.status})`;
        throw new Error(msg);
      }
      setItems(json.data || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const onAdd = async () => {
    const t = newText.trim();
    if (!t) return;
    setError(null);
    setOkMsg(null);
    setIsSubmitting(true);
    try {
      const r = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, content: t }),
      });
      const json = (await r.json().catch(() => null)) as
        | { ok: true; id: string }
        | { error: string }
        | null;
      if (!r.ok || !json || !("ok" in json)) {
        const msg =
          (json && "error" in json && json.error) || `添加失败 (${r.status})`;
        throw new Error(msg);
      }
      setNewText("");
      setOkMsg("已添加");
      setTimeout(() => setOkMsg(null), 1500);
      // 立即重新拉取，让新记忆出现在顶部
      await fetchList();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!confirmId) return;
    setError(null);
    setIsDeletingId(confirmId);
    try {
      const r = await fetch("/api/memories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: confirmId }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "删除失败");
      }
      setOkMsg("已删除");
      setTimeout(() => setOkMsg(null), 1500);
      setConfirmId(null);
      // 乐观更新
      setItems((arr) => arr.filter((m) => m.id !== confirmId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground p-4 md:p-6 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-primary" />
          <h3 className="text-base font-semibold">长期记忆管理</h3>
          <span className="text-xs text-muted-foreground">
            ({items.length} 条)
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={fetchList}
          disabled={isLoading}
          title="刷新"
        >
          <RefreshCw
            className={isLoading ? "size-4 animate-spin" : "size-4"}
          />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        系统会在每轮对话结束后自动抽取记忆入库。你也可以在这里手动补充关键事实（比如
        "用户是程序员，住在上海"），让 AI 在后续对话中自然调用。
      </p>

      {/* 手动添加 */}
      <div className="space-y-2">
        <Textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="手动添加一条记忆，例如：用户是一名全栈工程师，喜欢用 Rust 写 Web 后端。"
          rows={3}
          className="resize-none"
          disabled={isSubmitting}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={onAdd}
            disabled={isSubmitting || !newText.trim()}
            size="sm"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {isSubmitting ? "添加中..." : "手动添加记忆"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {okMsg && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {okMsg}
        </div>
      )}

      {/* 列表 */}
      <div className="space-y-2">
        {isLoading && items.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="size-4 animate-spin" />
            正在加载...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            暂无记忆。开始聊天后会自动积累，或在上面的输入框手动添加。
          </div>
        ) : (
          items.map((m) => (
            <div
              key={m.id}
              className="group rounded-lg border border-border/60 bg-background/40 hover:bg-muted/40 transition-colors p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words flex-1">
                  {m.content}
                </p>
                <button
                  type="button"
                  aria-label="删除记忆"
                  onClick={() => setConfirmId(m.id)}
                  disabled={isDeletingId === m.id}
                  className="size-7 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                  title="删除"
                >
                  {isDeletingId === m.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{formatDate(m.createdAt)}</span>
                {m.chatId && (
                  <span className="font-mono text-[10px]">
                    chat: {m.chatId.slice(0, 8)}…
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 删除确认弹窗 */}
      <Dialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除这条记忆？</DialogTitle>
            <DialogDescription>
              删除后 AI 在后续对话中不会再引用该记忆（但不会影响已生成的回复）。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmId(null)}
              disabled={!!isDeletingId}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmDelete}
              disabled={!!isDeletingId}
            >
              {isDeletingId ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {isDeletingId ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
