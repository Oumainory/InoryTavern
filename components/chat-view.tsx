"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Brain,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit2,
  Loader2,
  RefreshCw,
  Send,
  Square,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { getMessageContent, type CharacterDTO, type ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

let _idSeq = 0;
const newId = () => `m_${Date.now()}_${++_idSeq}`;

/**
 * 把消息正文拆成「思考段 + 文本段」的列表。
 * 兼容流式输出时 </think> 还没闭合的情况：用 `</think>` 或字符串末尾 作为分界。
 * 兼容多个 <think> 块交替出现。
 */
type Segment = { type: "thinking" | "text"; content: string };

function parseThinking(raw: string): Segment[] {
  if (!raw) return [];
  // 思路：扫描所有 <think> / </think> 标记的位置，用状态机走一遍。
  // 兼容 4 种情况：
  //   1. <think>...</think>        正常配对（DeepSeek-R1 / QwQ / o1 等）
  //   2. （思考）</think>          某些模型只写 </think> 不写 <think>（用户当前遇到的）
  //   3. <think>未闭合（流式中）   暂把到末尾都当 thinking
  //   4. 多个 思考块 交替出现      都能正确切分
  type Mark = { pos: number; isOpen: boolean; len: number };
  const marks: Mark[] = [];
  const re = /<\/?think>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    marks.push({
      pos: m.index,
      isOpen: m[0] === "<think>",
      len: m[0].length,
    });
  }

  // 没有任何 <think> / </think>：整段都是普通文本
  if (marks.length === 0) {
    return [{ type: "text", content: raw }];
  }

  const segs: Segment[] = [];
  let cursor = 0;
  let inThinking = false;
  let thinkStart = 0;

  for (const mark of marks) {
    if (mark.isOpen) {
      // <think>
      if (!inThinking) {
        // 之前的纯文本
        if (mark.pos > cursor) {
          segs.push({ type: "text", content: raw.slice(cursor, mark.pos) });
        }
        thinkStart = mark.pos + mark.len;
        inThinking = true;
      }
      // 已处于 thinking 态时再遇到 <think>：忽略（不嵌套）
    } else {
      // </think>
      if (inThinking) {
        // 正常闭合：把 [thinkStart, mark.pos) 当作 thinking
        segs.push({
          type: "thinking",
          content: raw.slice(thinkStart, mark.pos),
        });
        cursor = mark.pos + mark.len;
        inThinking = false;
      } else {
        // ⚠️ 孤儿 </think>：之前没有匹配的 <think>
        // 把 [cursor, mark.pos) 整段当作 thinking（适配只写闭标签的模型）
        if (mark.pos > cursor) {
          segs.push({
            type: "thinking",
            content: raw.slice(cursor, mark.pos),
          });
        }
        cursor = mark.pos + mark.len;
      }
    }
  }

  // 收尾：剩余的尾巴
  if (cursor < raw.length) {
    if (inThinking) {
      // 未闭合的 <think>：到末尾都是 thinking（流式中常见）
      segs.push({ type: "thinking", content: raw.slice(thinkStart) });
    } else {
      segs.push({ type: "text", content: raw.slice(cursor) });
    }
  }

  return segs;
}

/** 把思考块里的内容按行去掉空行，做成简短预览 */
function summarizeThinking(s: string): string {
  const lines = s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "思考中…";
  const head = lines[0];
  return head.length > 60 ? head.slice(0, 60) + "…" : head;
}

export function ChatView({
  character,
  chatId,
  initialMessages,
  onMessagesChange,
}: {
  character: CharacterDTO;
  chatId: string;
  initialMessages: ChatMessage[];
  onMessagesChange?: (msgs: ChatMessage[]) => void;
}) {
  // 给历史消息补 id，并把 swipes 数组也用 getMessageContent 同步到 content（保证 content 与 active 同步）
  const seeded = (() => {
    return initialMessages.map((m) => {
      const id = m.id || newId();
      if (Array.isArray(m.swipes) && m.swipes.length > 0) {
        return { ...m, id, content: getMessageContent(m) };
      }
      return { ...m, id };
    });
  })();

  const [messages, setMessages] = useState<ChatMessage[]>(seeded);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 切换 chatId 时重置
  useEffect(() => {
    setMessages(
      initialMessages.map((m) => {
        const id = m.id || newId();
        if (Array.isArray(m.swipes) && m.swipes.length > 0) {
          return { ...m, id, content: getMessageContent(m) };
        }
        return { ...m, id };
      })
    );
    setInput("");
    abortRef.current?.abort();
    setStreaming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // 把 messages 同步给父级
  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  // 自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  // 取最后一条 user 消息索引
  const lastUserIdx = (() => {
    for (let j = messages.length - 1; j >= 0; j--) {
      if (messages[j].role === "user") return j;
    }
    return -1;
  })();

  // 删除指定 index 的消息
  const removeAt = (idx: number) => {
    setMessages((msgs) => msgs.filter((_, i) => i !== idx));
  };

  // ============ 通用流式请求 ============
  // 模式 1：消息历史以 user 结尾（正常回复）→ 在末尾追加新 assistant 占位
  // 模式 2：消息历史以带 swipes 的 assistant 结尾（重新生成）→ 复用该 assistant，写入 swipes[activeSwipe]
  const streamCompletion = async (history: ChatMessage[], isRegen: boolean) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);

    // 在客户端先放占位
    if (isRegen) {
      // 不动 messages，UI 上 activeSwipe 对应的占位是 swipes[activeSwipe]，流式更新它
    } else {
      setMessages((msgs) => [
        ...msgs,
        { id: newId(), role: "assistant", content: "" },
      ]);
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          messages: history,
          chatId,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const t = await res.text();
        throw new Error(t || "请求失败");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: rDone } = await reader.read();
        done = rDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            setMessages((msgs) => {
              const arr = [...msgs];
              const last = arr[arr.length - 1];
              if (!last || last.role !== "assistant") return arr;
              if (isRegen && Array.isArray(last.swipes)) {
                // 写入 swipes[activeSwipe]
                const idx = last.activeSwipe ?? 0;
                const nextSwipes = [...last.swipes];
                while (nextSwipes.length <= idx) nextSwipes.push("");
                nextSwipes[idx] = (nextSwipes[idx] || "") + chunk;
                arr[arr.length - 1] = { ...last, swipes: nextSwipes };
              } else {
                arr[arr.length - 1] = { ...last, content: last.content + chunk };
              }
              return arr;
            });
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((msgs) => {
          const arr = [...msgs];
          const last = arr[arr.length - 1];
          if (!last || last.role !== "assistant") return arr;
          const errSuffix = `\n\n[错误] ${(err as Error).message}`;
          if (Array.isArray(last.swipes) && isRegen) {
            const idx = last.activeSwipe ?? 0;
            const nextSwipes = [...last.swipes];
            while (nextSwipes.length <= idx) nextSwipes.push("");
            nextSwipes[idx] = (nextSwipes[idx] || "") + errSuffix;
            arr[arr.length - 1] = { ...last, swipes: nextSwipes };
          } else {
            arr[arr.length - 1] = { ...last, content: last.content + errSuffix };
          }
          return arr;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  // 重新生成：找最后一条 assistant 消息（不限定是否 swipes）
  // 行为：保留所有历史到该 assistant 之前；将该 assistant 转为"带 swipes 的 placeholder"，
  //       末尾加一个新空 swipe，activeSwipe 指向新 swipe，发起流式
  const regenerate = async () => {
    if (streaming) return;
    if (lastUserIdx < 0) return;
    const base = messages.slice(0, lastUserIdx + 1);
    // 找 base 末尾之后是否还有 assistant 消息
    const afterUser = messages.slice(lastUserIdx + 1);
    if (afterUser.length === 0) {
      // 没有上一条 AI 回复：当作普通请求
      await streamCompletion(base, false);
      return;
    }
    // 把最后一条 assistant 转为 swipes 模式
    const lastAssistant = afterUser[afterUser.length - 1];
    if (lastAssistant.role !== "assistant") return;
    const existingSwipes = Array.isArray(lastAssistant.swipes) ? lastAssistant.swipes : [getMessageContent(lastAssistant)];
    const newSwipes = [...existingSwipes, ""];
    const newActive = newSwipes.length - 1;
    const updated: ChatMessage = {
      ...lastAssistant,
      swipes: newSwipes,
      activeSwipe: newActive,
      content: "",
    };
    const fullHistory = [...base, updated];
    setMessages(fullHistory);
    // 流式会写入 updated.swipes[newActive]
    await streamCompletion(fullHistory, true);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const newUserMsg: ChatMessage = { id: newId(), role: "user", content: text };
    const next: ChatMessage[] = [...messages, newUserMsg];
    setMessages(next);
    await streamCompletion(next, false);
  };

  // 切换 swipe
  const switchSwipe = (idx: number, delta: 1 | -1) => {
    setMessages((msgs) => {
      const arr = [...msgs];
      const last = arr[arr.length - 1];
      if (!last || !Array.isArray(last.swipes) || last.swipes.length <= 1) return arr;
      const cur = last.activeSwipe ?? 0;
      const next = Math.max(0, Math.min(last.swipes.length - 1, cur + delta));
      arr[arr.length - 1] = { ...last, activeSwipe: next };
      return arr;
    });
  };

  // 用户消息：编辑保存 → 截断之后所有消息 + 用新文本重新发起
  const saveUserEdit = async (idx: number, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    if (streaming) return;
    // 截断到 idx（包含）
    const truncated = messages.slice(0, idx + 1).map((m, i) =>
      i === idx ? { ...m, content: trimmed } : m
    );
    setMessages(truncated);
    setEditingIdx(null);
    await streamCompletion(truncated, false);
  };

  // AI 消息：编辑保存 → 仅更新该消息 content（保留 swipes，但更新当前显示的 content）
  const saveAssistantEdit = (idx: number, newText: string) => {
    setMessages((msgs) => {
      const arr = [...msgs];
      const m = arr[idx];
      if (!m || m.role !== "assistant") return arr;
      if (Array.isArray(m.swipes) && m.swipes.length > 0) {
        const i = m.activeSwipe ?? 0;
        const next = [...m.swipes];
        while (next.length <= i) next.push("");
        next[i] = newText;
        arr[idx] = { ...m, swipes: next };
      } else {
        arr[idx] = { ...m, content: newText };
      }
      return arr;
    });
    setEditingIdx(null);
  };

  // 消息变化时同步给后端（节流）
  useEffect(() => {
    if (streaming) return;
    if (!chatId) return;
    if (messages === initialMessages) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/chats/${chatId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: ctrl.signal,
      }).catch(() => {});
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [messages, streaming, chatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // 当前正在编辑的消息 idx
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <div className="text-sm text-muted-foreground">
          {messages.length} 条消息
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("确定清空当前对话？此操作仅清空显示，不会删除会话。")) {
              setMessages([]);
            }
          }}
          disabled={streaming}
          type="button"
        >
          <Trash2 className="size-3.5" />
          清空对话
        </Button>
      </div>

      {/* 消息列表 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <div className="text-5xl mb-3">💬</div>
            <p>向 {character.name} 说点什么吧</p>
            {character.firstMessage && (
              <div className="mt-4 max-w-md rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                <div className="text-xs text-muted-foreground mb-1">
                  {character.name} 的开场白：
                </div>
                {character.firstMessage}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          // 当前 AI 消息：最后一条 assistant 才有 swipe 控制 + 重新生成
          const canRegen = !streaming && isLast && m.role === "assistant" && lastUserIdx >= 0;
          // 用户消息：最后一条 user 时显示"重新生成"快捷入口
          const isLastUser = m.role === "user" && i === lastUserIdx && isLast;
          return (
            <Bubble
              key={m.id || `${i}-${m.role}`}
              role={m.role}
              message={m}
              name={m.role === "user" ? "你" : character.name}
              isLast={isLast}
              streaming={streaming}
              canRegen={canRegen || isLastUser}
              onRegenerate={regenerate}
              onDelete={() => removeAt(i)}
              onSwitchSwipe={(delta) => switchSwipe(i, delta)}
              onEdit={() => setEditingIdx(i)}
              isEditing={editingIdx === i}
              onCancelEdit={() => setEditingIdx(null)}
              onSaveEdit={(text) =>
                m.role === "user"
                  ? saveUserEdit(i, text)
                  : saveAssistantEdit(i, text)
              }
            />
          );
        })}
      </div>

      {/* 输入区 */}
      <div className="border-t border-border/60 p-4">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={`输入消息…（Shift+Enter 换行）`}
            rows={2}
            className="resize-none"
            disabled={streaming}
          />
          {streaming ? (
            <Button onClick={stop} variant="destructive" size="icon" type="button">
              <Square className="size-4" />
            </Button>
          ) : (
            <Button onClick={send} size="icon" type="button" disabled={!input.trim()}>
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============== Bubble 子组件 ==============

function Bubble({
  role,
  message,
  name,
  isLast,
  streaming,
  canRegen,
  onRegenerate,
  onDelete,
  onSwitchSwipe,
  onEdit,
  isEditing,
  onCancelEdit,
  onSaveEdit,
}: {
  role: "user" | "assistant" | "system";
  message: ChatMessage;
  name: string;
  isLast: boolean;
  streaming: boolean;
  canRegen: boolean;
  onRegenerate: () => void;
  onDelete: () => void;
  onSwitchSwipe?: (delta: 1 | -1) => void;
  onEdit: () => void;
  isEditing: boolean;
  onCancelEdit: () => void;
  onSaveEdit: (text: string) => void;
}) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [editValue, setEditValue] = useState(getMessageContent(message));

  // 消息变化时同步 editValue
  useEffect(() => {
    if (!isEditing) {
      setEditValue(getMessageContent(message));
    }
  }, [message, isEditing]);

  // 显示的内容（编辑态下显示正在编辑的 draft）
  const displayContent = isEditing ? editValue : getMessageContent(message);
  const swipes = Array.isArray(message.swipes) ? message.swipes : null;
  const activeSwipe = message.activeSwipe ?? 0;
  const showSwipeNav = swipes && swipes.length > 1 && isLast && role === "assistant";

  // 进入编辑时初始化 editValue
  useEffect(() => {
    if (isEditing) setEditValue(displayContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // 复制
  const onCopy = async () => {
    try {
      // 复制时也去掉思考块，避免把内部思考过程粘出去
      await navigator.clipboard.writeText(stripThinking(displayContent));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* 忽略 */
    }
  };

  // 朗读
  const onSpeak = async () => {
    if (speaking) {
      audioRef.current?.pause();
      audioRef.current = null;
      setSpeaking(false);
      return;
    }
    // 朗读时去掉思考块，只读可见回复
    const ttsText = stripThinking(displayContent);
    if (!ttsText.trim()) return;
    setSpeaking(true);
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "语音合成失败");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      await audio.play();
    } catch (err) {
      setSpeaking(false);
      if (typeof window !== "undefined") {
        window.alert("朗读失败：" + (err as Error).message);
      }
    }
  };

  // 卸载时清理音频
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return (
    <div className={cn("flex gap-3 group", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "size-8 shrink-0 rounded-full flex items-center justify-center text-xs font-medium",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        )}
      >
        {name.slice(0, 1)}
      </div>
      <div className={cn("flex flex-col max-w-[75%]", isUser && "items-end")}>
        <div className="text-xs text-muted-foreground mb-1 px-1">{name}</div>

        {/* swipe 切换：右上角（在气泡上方） */}
        {showSwipeNav && onSwitchSwipe && (
          <div className="mb-1 flex items-center gap-1 rounded-full border border-border/60 bg-background/70 backdrop-blur px-1 py-0.5 text-[10px] text-muted-foreground">
            <Button
              variant="ghost"
              size="icon"
              className="size-5 rounded-full"
              onClick={() => onSwitchSwipe(-1)}
              disabled={activeSwipe <= 0}
              aria-label="上一条"
            >
              <ChevronLeft className="size-3" />
            </Button>
            <span className="tabular-nums px-1">
              {activeSwipe + 1} / {swipes!.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-5 rounded-full"
              onClick={() => onSwitchSwipe(1)}
              disabled={activeSwipe >= swipes!.length - 1}
              aria-label="下一条"
            >
              <ChevronRight className="size-3" />
            </Button>
          </div>
        )}

        {/* 气泡本体 */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm break-words",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap"
              : "bg-muted text-foreground rounded-tl-sm markdown-body"
          )}
        >
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={Math.min(8, Math.max(3, editValue.split("\n").length))}
                className="bg-background text-foreground"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={isUser ? "default" : "secondary"}
                  onClick={() => onSaveEdit?.(editValue)}
                  disabled={!editValue.trim()}
                >
                  <Check className="size-3.5" />
                  {isUser ? "保存并重新提交" : "保存修改"}
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                  <X className="size-3.5" />
                  取消
                </Button>
              </div>
            </div>
          ) : isUser ? (
            displayContent
          ) : (
            <MessageWithThinking content={displayContent} streaming={isLast && streaming} />
          )}
        </div>

        {/* 底部操作栏 */}
        {!isEditing && !streaming && (
          <div
            className={cn(
              "mt-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
              isUser && "flex-row-reverse"
            )}
          >
            <IconBtn onClick={onCopy} title="复制" active={copied}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </IconBtn>
            <IconBtn onClick={onEdit} title="编辑">
              <Edit2 className="size-3.5" />
            </IconBtn>
            {!isUser && (
              <IconBtn onClick={onSpeak} title={speaking ? "停止" : "朗读"} active={speaking}>
                {speaking ? <Loader2 className="size-3.5 animate-spin" /> : <Volume2 className="size-3.5" />}
              </IconBtn>
            )}
            {canRegen && (
              <IconBtn
                onClick={onRegenerate}
                title={isUser ? "用此条用户消息重新请求 AI" : "重新生成（追加到分支）"}
              >
                <RefreshCw className="size-3.5" />
              </IconBtn>
            )}
            <IconBtn onClick={onDelete} title="删除此条" hoverDanger>
              <X className="size-3.5" />
            </IconBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  onClick,
  title,
  children,
  active,
  hoverDanger,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
  hoverDanger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "size-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
        active && "bg-muted text-foreground",
        hoverDanger && "hover:text-destructive"
      )}
    >
      {children}
    </button>
  );
}

/** 去掉 <think>...</think> 块（未闭合的也去掉），用于复制 / 朗读 */
function stripThinking(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "")
    .trim();
}

/**
 * 渲染带思考过程的 AI 消息：把 <think>...</think> 段拆出来作为可折叠块，
 * 剩余纯文本段交给 ReactMarkdown。
 */
function MessageWithThinking({
  content,
  streaming,
}: {
  content: string;
  streaming: boolean;
}) {
  const segs = useMemo(() => parseThinking(content), [content]);
  // 没有任何思考块 → 退回原来的 ReactMarkdown
  if (segs.length === 0 || segs.every((s) => s.type === "text")) {
    return (
      <>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content || ""}
        </ReactMarkdown>
        {streaming && (
          <span className="ml-0.5 inline-block w-1.5 h-3.5 align-middle bg-foreground/70 animate-pulse" />
        )}
      </>
    );
  }
  return (
    <div className="space-y-2">
      {segs.map((seg, idx) =>
        seg.type === "thinking" ? (
          <ThinkingBlock key={idx} content={seg.content} streaming={streaming} />
        ) : seg.content.trim() ? (
          <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]}>
            {seg.content}
          </ReactMarkdown>
        ) : null
      )}
      {streaming && (
        <span className="ml-0.5 inline-block w-1.5 h-3.5 align-middle bg-foreground/70 animate-pulse" />
      )}
    </div>
  );
}

/** 可折叠的思考过程块（Monica 风格） */
function ThinkingBlock({
  content,
  streaming,
}: {
  content: string;
  streaming: boolean;
}) {
  const [open, setOpen] = useState(false);
  // 流式输出时默认展开（让用户看到思考进展），结束态默认折叠
  const effectivelyOpen = open || streaming;
  return (
    <div className="rounded-lg border border-border/60 bg-muted/50 p-3 mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={effectivelyOpen}
      >
        <Brain className="size-3.5 shrink-0" />
        <span className="font-medium">思考过程</span>
        {!effectivelyOpen && (
          <span className="truncate text-xs opacity-70 max-w-[60%]">
            {summarizeThinking(content)}
          </span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto size-4 shrink-0 transition-transform",
            effectivelyOpen && "rotate-180"
          )}
        />
      </button>
      {effectivelyOpen && (
        <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground border-t border-border/40 pt-2">
          {content}
        </div>
      )}
    </div>
  );
}
