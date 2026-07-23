// 角色卡片：瀑布流中单个
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, MessageCircle, Pencil, Download, Sparkles, Trash2 } from "lucide-react";
import type { CharacterDTO } from "@/lib/types";
import { writeTavernPng, buildTavernV2Card } from "@/lib/png-utils";

export function CharacterCard({ character }: { character: CharacterDTO }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onExport = async () => {
    if (!character.avatar) {
      const msg = "该角色没有头像，无法导出 PNG 角色卡";
      setError(msg);
      if (typeof window !== "undefined") window.alert(msg);
      return;
    }
    setError(null);
    setExporting(true);
    try {
      const card = buildTavernV2Card({
        name: character.name,
        description: character.description,
        personality: character.personality,
        firstMessage: character.firstMessage,
        systemPrompt: character.systemPrompt,
        worldbook: (character.worldbook || []).map((w) => ({
          keyword: w.keyword,
          content: w.content,
        })),
      });
      const dataUrl = await writeTavernPng(character.avatar, card);
      // 触发下载
      const a = document.createElement("a");
      a.href = dataUrl;
      // 文件名做简单的安全处理
      const safeName = (character.name || "character").replace(/[\\/:*?"<>|]/g, "_");
      a.download = `${safeName}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError("导出失败：" + (err as Error).message);
      if (typeof window !== "undefined") {
        window.alert("导出失败：" + (err as Error).message);
      }
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      const r = await fetch(`/api/characters/${character.id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "删除失败");
      }
      setConfirmOpen(false);
      // 优先尝试 router.refresh 走 Next.js 的软刷新；
      // 若 200ms 后仍未触发重渲染（路由缓存导致没反应），强制 reload。
      router.refresh();
      window.setTimeout(() => {
        // 检查卡片是否还在 DOM：若仍在则强制刷新页面
        // 用 querySelector 找到包含角色名的 Card 节点
        const stillThere = document.querySelector(
          `[data-character-id="${character.id}"]`
        );
        if (stillThere) {
          window.location.reload();
        }
      }, 300);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card
      data-character-id={character.id}
      className="break-inside-avoid mb-4 overflow-hidden group/card relative"
    >
      {/* 头像 / 封面 */}
      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-primary/20 via-accent/30 to-secondary/40 overflow-hidden">
        {character.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={character.avatar}
            alt={character.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl font-heading text-foreground/40 select-none">
            {character.name.slice(0, 1)}
          </div>
        )}
        {character.isNsfw && (
          <span className="absolute top-2 right-2 rounded-full bg-destructive/90 text-destructive-foreground px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase">
            NSFW
          </span>
        )}
        {/* 编辑 + 导出 + 删除按钮：右上角悬浮 */}
        <div className="absolute top-2 left-2 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <LinkButton
            href={`/edit/${character.id}`}
            variant="default"
            size="icon"
            className="size-8 rounded-full bg-background/70 backdrop-blur text-foreground hover:bg-secondary"
            aria-label="编辑角色"
            onClick={(e) => e.stopPropagation()}
          >
            <Pencil className="size-4" />
          </LinkButton>
          <button
            type="button"
            aria-label="导出 PNG 角色卡"
            disabled={exporting}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onExport();
            }}
            className="size-8 rounded-full bg-background/70 backdrop-blur text-foreground hover:bg-secondary flex items-center justify-center disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
          </button>
          <button
            type="button"
            aria-label="删除角色"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setConfirmOpen(true);
            }}
            className="size-8 rounded-full bg-background/70 backdrop-blur text-destructive hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1">{character.name}</CardTitle>
          <Sparkles className="size-4 text-muted-foreground shrink-0" />
        </div>
        <CardDescription className="line-clamp-3 min-h-[3.75rem]">
          {character.description}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {character.personality && (
          <div className="text-xs text-muted-foreground line-clamp-2 mb-3">
            <span className="text-foreground/80 font-medium">性格：</span>
            {character.personality}
          </div>
        )}
        <LinkButton href={`/chat/${character.id}`} className="w-full" size="sm">
          <MessageCircle className="size-4" />
          开始聊天
        </LinkButton>
      </CardContent>

      {/* 二次确认弹窗 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除角色「{character.name}」？</DialogTitle>
            <DialogDescription>
              该操作会同时删除该角色下的所有对话记录和世界书条目，且无法恢复。
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
