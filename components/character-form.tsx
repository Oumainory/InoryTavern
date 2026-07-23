// 角色表单：复用于创建（/create）和编辑（/edit/[id]）
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LinkButton } from "@/components/ui/link-button";
import { RadioGroup } from "@/components/ui/radio-group";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
  BookText,
  Theater,
} from "lucide-react";
import type { WorldbookEntryDTO } from "@/lib/types";
import { readTavernPng, normalizeTavernCard } from "@/lib/png-utils";

export type CharacterFormInitial = {
  id: string;
  name: string;
  avatar: string | null;
  description: string;
  personality: string | null;
  firstMessage: string | null;
  systemPrompt: string | null;
  isNsfw: boolean;
  worldbook: WorldbookEntryDTO[];
  // ----- 高级角色设定（参考 SillyTavern） -----
  userCharacterName?: string | null;
  playStyle?: string | null;
  replyMode?: string | null;
  replyLength?: number | null;
  dialogueExamples?: string | null;
  scenario?: string | null;
  replyEnhancement?: string | null;
};

type WorldbookEntryForm = {
  _key: string;
  keyword: string;
  content: string;
};

// /api/generate-character 返回的数据结构
type GeneratedCharacterData = {
  name?: string;
  description?: string;
  personality?: string;
  firstMessage?: string;
  systemPrompt?: string;
  worldbook?: { keyword?: string; content?: string }[];
};

type FormState = {
  name: string;
  avatar: string;
  description: string;
  personality: string;
  firstMessage: string;
  // 这里只存用户写的 system prompt，不含采样参数（采样参数在提交时再拼）
  systemPrompt: string;
  isNsfw: boolean;
  temperature: number;
  topP: number;
  worldbook: WorldbookEntryForm[];
  // ----- 高级角色设定（参考 SillyTavern） -----
  userCharacterName: string;
  playStyle: string;
  replyMode: string;
  replyLength: number;
  dialogueExamples: string;
  scenario: string;
  replyEnhancement: string;
};

const DEFAULTS: FormState = {
  name: "",
  avatar: "",
  description: "",
  personality: "",
  firstMessage: "",
  systemPrompt: "",
  isNsfw: false,
  temperature: 0.8,
  topP: 0.95,
  worldbook: [],
  userCharacterName: "",
  playStyle: "1v1",
  replyMode: "immersive",
  replyLength: 500,
  dialogueExamples: "",
  scenario: "",
  replyEnhancement: "none",
};

// 从已存的 systemPrompt 里尽量拆出【采样参数】块（之前创建时拼的）
function parseSamplingFromSystemPrompt(s: string | null): {
  systemPrompt: string;
  temperature: number;
  topP: number;
} {
  const defaults = { systemPrompt: s || "", temperature: 0.8, topP: 0.95 };
  if (!s) return defaults;
  // 匹配 \n\n【采样参数】\n... 块
  const m = s.match(/\n*【采样参数】\s*\n([\s\S]*?)$/);
  if (!m) return defaults;
  const block = m[1];
  const tMatch = block.match(/temperature\s*=\s*([\d.]+)/);
  const pMatch = block.match(/top_p\s*=\s*([\d.]+)/);
  return {
    systemPrompt: s.slice(0, m.index).trimEnd(),
    temperature: tMatch ? Number(tMatch[1]) : 0.8,
    topP: pMatch ? Number(pMatch[1]) : 0.95,
  };
}

// 把 File 压缩到最大边长 512px 的 JPEG，返回 Base64 data URL
async function fileToCompressedBase64(
  file: File,
  maxSide = 512,
  quality = 0.85
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("图片加载失败"));
    i.src = dataUrl;
  });

  const w = img.width;
  const h = img.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const tw = Math.round(w * scale);
  const th = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 canvas context");
  ctx.drawImage(img, 0, 0, tw, th);

  return canvas.toDataURL("image/jpeg", quality);
}

let _keySeq = 0;
const nextKey = () => `wb_${Date.now()}_${++_keySeq}`;

export function CharacterForm({
  initialData,
}: {
  initialData?: CharacterFormInitial;
}) {
  const router = useRouter();
  const isEdit = !!initialData;
  const [form, setForm] = useState<FormState>(() => {
    if (!initialData) return DEFAULTS;
    const parsed = parseSamplingFromSystemPrompt(initialData.systemPrompt);
    return {
      name: initialData.name,
      avatar: initialData.avatar || "",
      description: initialData.description,
      personality: initialData.personality || "",
      firstMessage: initialData.firstMessage || "",
      systemPrompt: parsed.systemPrompt,
      isNsfw: initialData.isNsfw,
      temperature: parsed.temperature,
      topP: parsed.topP,
      worldbook: initialData.worldbook.map((w) => ({
        _key: nextKey(),
        keyword: w.keyword,
        content: w.content,
      })),
      userCharacterName: initialData.userCharacterName || "",
      playStyle: initialData.playStyle || "1v1",
      replyMode: initialData.replyMode || "immersive",
      replyLength:
        typeof initialData.replyLength === "number" && initialData.replyLength > 0
          ? initialData.replyLength
          : 500,
      dialogueExamples: initialData.dialogueExamples || "",
      scenario: initialData.scenario || "",
      replyEnhancement: initialData.replyEnhancement || "none",
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [genPrompt, setGenPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const addWorldbookEntry = () => {
    set("worldbook", [
      ...form.worldbook,
      { _key: nextKey(), keyword: "", content: "" },
    ]);
  };

  const updateWorldbookEntry = (
    key: string,
    patch: Partial<Omit<WorldbookEntryForm, "_key">>
  ) => {
    set(
      "worldbook",
      form.worldbook.map((e) => (e._key === key ? { ...e, ...patch } : e))
    );
  };

  const removeWorldbookEntry = (key: string) => {
    set("worldbook", form.worldbook.filter((e) => e._key !== key));
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    setError(null);
    setAvatarBusy(true);
    try {
      const base64 = await fileToCompressedBase64(file);
      set("avatar", base64);
    } catch (err) {
      setError("图片处理失败：" + (err as Error).message);
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onClearAvatar = () => set("avatar", "");

  const onImportPng = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 先清空 input value，允许重复选同一张
    if (importInputRef.current) importInputRef.current.value = "";
    if (!file) return;
    setError(null);
    setImporting(true);
    try {
      const card = await readTavernPng(file);
      const data = normalizeTavernCard(card);
      set("name", data.name || "");
      set("description", data.description || "");
      set("personality", data.personality || "");
      set("firstMessage", data.firstMessage || "");
      set("systemPrompt", data.systemPrompt || "");
      if (Array.isArray(data.worldbook) && data.worldbook.length > 0) {
        set(
          "worldbook",
          data.worldbook.map((w) => ({
            _key: nextKey(),
            keyword: w.keyword || "",
            content: w.content || "",
          }))
        );
      }
      // 把整张 PNG 设为头像（直接读 file 转 dataURL）
      const avatarDataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error || new Error("读取失败"));
        r.readAsDataURL(file);
      });
      set("avatar", avatarDataUrl);
      if (typeof window !== "undefined") {
        window.alert(
          `已导入「${data.name || "未命名"}」：请检查并修改细节后保存。`
        );
      }
    } catch (err) {
      setError("导入失败：" + (err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const onGenerate = async () => {
    const p = genPrompt.trim();
    if (!p) {
      setError("请先输入角色描述");
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      // 尝试解析响应体（无论成功失败）
      const payload = (await res.json().catch(() => null)) as
        | { ok: true; data: GeneratedCharacterData }
        | { error: string }
        | null;
      if (!res.ok || !payload || !("ok" in payload) || !payload.ok) {
        const msg =
          (payload && "error" in payload && payload.error) ||
          `生成失败（HTTP ${res.status}）`;
        throw new Error(msg);
      }
      const data = payload.data;
      // 依次填充到表单 state（缺字段时回退到空串）
      set("name", data.name || "");
      set("description", data.description || "");
      set("personality", data.personality || "");
      set("firstMessage", data.firstMessage || "");
      set("systemPrompt", data.systemPrompt || "");
      if (Array.isArray(data.worldbook)) {
        set(
          "worldbook",
          data.worldbook
            .filter((w) => w && (w.keyword || w.content))
            .map((w) => ({
              _key: nextKey(),
              keyword: w.keyword || "",
              content: w.content || "",
            }))
        );
      }
      if (typeof window !== "undefined") {
        // 简单提示：toast 还没接，先用 alert
        window.alert("生成成功！请检查并修改细节后保存。");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.description.trim()) {
      setError("角色名和简介为必填项");
      return;
    }
    setSubmitting(true);
    try {
      // 拼接 systemPrompt
      const sys = [
        form.systemPrompt,
        "",
        "【采样参数】",
        `temperature=${form.temperature.toFixed(2)}`,
        `top_p=${form.topP.toFixed(2)}`,
      ]
        .filter(Boolean)
        .join("\n");

      // 过滤掉空的 worldbook 条目
      const worldbook = form.worldbook
        .filter((e) => e.keyword.trim() || e.content.trim())
        .map((e) => ({
          keyword: e.keyword.trim(),
          content: e.content.trim(),
        }));

      const payload = {
        name: form.name,
        avatar: form.avatar || null,
        description: form.description,
        personality: form.personality || null,
        firstMessage: form.firstMessage || null,
        systemPrompt: sys || null,
        isNsfw: form.isNsfw,
        worldbook,
        // ----- 高级角色设定 -----
        userCharacterName: form.userCharacterName.trim() || null,
        playStyle: form.playStyle || "1v1",
        replyMode: form.replyMode || "immersive",
        replyLength:
          typeof form.replyLength === "number" && form.replyLength > 0
            ? Math.round(form.replyLength)
            : 500,
        dialogueExamples: form.dialogueExamples.trim() || null,
        scenario: form.scenario.trim() || null,
        replyEnhancement: form.replyEnhancement || "none",
      };

      const url = isEdit ? `/api/characters/${initialData!.id}` : "/api/characters";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || (isEdit ? "更新失败" : "创建失败"));
      }
      const data = await res.json();
      // 创建后跳到聊天页；编辑后跳到聊天页
      router.push(`/chat/${data.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <LinkButton href="/" variant="ghost" size="icon" aria-label="返回">
          <ArrowLeft className="size-4" />
        </LinkButton>
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            {isEdit ? "编辑角色" : "创建角色"}
          </h1>
          <p className="text-sm text-muted-foreground">
            设定基础信息、高级行为与世界书，让角色活起来。
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        {/* ✨ AI 智能捏卡 */}
        <div className="mb-4 rounded-xl border border-purple-200/60 dark:border-purple-800/40 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/30 dark:via-blue-950/30 dark:to-indigo-950/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wand2 className="size-4 text-purple-600 dark:text-purple-400" />
            <div className="text-sm font-semibold text-purple-900 dark:text-purple-100">
              ✨ AI 智能捏卡
            </div>
            <span className="text-[10px] text-purple-700/70 dark:text-purple-300/70 ml-1">
              一句话描述，自动生成完整设定
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Textarea
              value={genPrompt}
              onChange={(e) => setGenPrompt(e.target.value)}
              placeholder="例如：帮我写一个傲娇的白毛吸血鬼萝莉，背景是现代都市..."
              rows={2}
              disabled={isGenerating}
              className="flex-1 bg-white/70 dark:bg-black/20 border-purple-200/60 dark:border-purple-800/40"
            />
            <Button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating}
              className="sm:self-start sm:min-w-[140px] bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              {isGenerating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {isGenerating ? "生成中..." : "✨ 一键生成设定"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-purple-700/70 dark:text-purple-300/70">
            生成时会调用在「设置」页配置的大模型，按 API 用量计费。
          </p>
          {/* 导入 PNG 角色卡 */}
          <div className="mt-3 flex items-center gap-2 border-t border-purple-200/50 dark:border-purple-800/40 pt-3">
            <input
              ref={importInputRef}
              type="file"
              accept="image/png,.png"
              onChange={onImportPng}
              className="hidden"
              id="import-png-file"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              disabled={importing || isGenerating}
              className="bg-white/70 dark:bg-black/20 border-purple-200/60 dark:border-purple-800/40 text-purple-900 dark:text-purple-100 hover:bg-purple-50 dark:hover:bg-purple-950/40"
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {importing ? "导入中..." : "📥 导入 PNG 角色卡"}
            </Button>
            <span className="text-[11px] text-purple-700/70 dark:text-purple-300/70">
              从 InoryTavern / Tavern 导出的 PNG 卡片
            </span>
          </div>
        </div>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="basic">基础设定</TabsTrigger>
            <TabsTrigger value="advanced">高级设定</TabsTrigger>
            <TabsTrigger value="scenario">
              <Theater className="size-3.5" />
              场景与示例
            </TabsTrigger>
            <TabsTrigger value="worldbook">
              <BookText className="size-3.5" />
              世界书
              {form.worldbook.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/15 text-primary px-1.5 text-[10px] tabular-nums">
                  {form.worldbook.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <Card>
              <CardHeader>
                <CardTitle>基础信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="角色名 *" htmlFor="name">
                  <Input
                    id="name"
                    placeholder="例如：苏暮雨"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    maxLength={40}
                  />
                </Field>
                <Field
                  label="用户角色名（非必填）"
                  htmlFor="userCharacterName"
                  hint="不会在聊天中展示，但可帮 AI 更好生成对话内容（例如：「我」/「旅行者」/「小明」）"
                >
                  <Input
                    id="userCharacterName"
                    placeholder="例如：旅行者"
                    value={form.userCharacterName}
                    onChange={(e) => set("userCharacterName", e.target.value)}
                    maxLength={40}
                  />
                </Field>
                <Field
                  label="头像"
                  hint="选择本地图片，自动压缩到 512px 并以 Base64 存储"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-20 rounded-lg overflow-hidden border border-border bg-muted shrink-0 flex items-center justify-center text-2xl font-heading text-foreground/40">
                      {form.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={form.avatar}
                          alt="头像预览"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (form.name.slice(0, 1) || "?")
                      )}
                    </div>
                    <div className="flex-1 flex flex-wrap gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={onPickAvatar}
                        className="hidden"
                        id="avatar-file"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarBusy}
                      >
                        <ImagePlus className="size-4" />
                        {avatarBusy
                          ? "处理中..."
                          : form.avatar
                          ? "更换"
                          : "选择图片"}
                      </Button>
                      {form.avatar && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={onClearAvatar}
                        >
                          <X className="size-4" />
                          移除
                        </Button>
                      )}
                    </div>
                  </div>
                </Field>
                <Field label="简介 *" htmlFor="description">
                  <Textarea
                    id="description"
                    placeholder="一句话描述这个角色：身份、背景、动机..."
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    rows={3}
                  />
                </Field>
                <Field label="性格" htmlFor="personality">
                  <Textarea
                    id="personality"
                    placeholder="例如：高冷、毒舌但内心柔软；说话带古风..."
                    value={form.personality}
                    onChange={(e) => set("personality", e.target.value)}
                    rows={3}
                  />
                </Field>
                <Field label="首条消息（开场白）" htmlFor="firstMessage">
                  <Textarea
                    id="firstMessage"
                    placeholder="AI 在用户没说话时发送的开场白"
                    value={form.firstMessage}
                    onChange={(e) => set("firstMessage", e.target.value)}
                    rows={3}
                  />
                </Field>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="text-sm font-medium">NSFW 内容</div>
                    <div className="text-xs text-muted-foreground">
                      开启后允许生成成人向内容
                    </div>
                  </div>
                  <Switch
                    checked={form.isNsfw}
                    onCheckedChange={(v) => set("isNsfw", v)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced">
            <Card>
              <CardHeader>
                <CardTitle>高级行为</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Field
                  label="系统提示词"
                  htmlFor="sys"
                  hint="深度定制 AI 的行为准则、人设、说话风格等"
                >
                  <Textarea
                    id="sys"
                    placeholder="例如：你是一位精通唐代诗词的女诗人..."
                    value={form.systemPrompt}
                    onChange={(e) => set("systemPrompt", e.target.value)}
                    rows={6}
                  />
                </Field>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Temperature</label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {form.temperature.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[form.temperature]}
                    min={0}
                    max={2}
                    step={0.05}
                    onValueChange={(v) =>
                      set("temperature", Array.isArray(v) ? v[0] : v)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    越高越发散，越低越发确定
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Top P</label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {form.topP.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[form.topP]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={(v) => set("topP", Array.isArray(v) ? v[0] : v)}
                  />
                  <p className="text-xs text-muted-foreground">
                    nucleus sampling 阈值
                  </p>
                </div>

                <div className="h-px bg-border" />

                {/* 玩法类型 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">玩法类型</label>
                    <span className="text-[10px] text-muted-foreground">
                      决定整体的对话走向
                    </span>
                  </div>
                  <RadioGroup
                    value={form.playStyle}
                    onValueChange={(v) => set("playStyle", v)}
                    options={[
                      {
                        value: "1v1",
                        label: "对手戏 (1v1)",
                        description: "专注角色间的互动，情感与对话张力。",
                      },
                      {
                        value: "story",
                        label: "推剧情 (story)",
                        description: "侧重情节发展与探索，NPC 推进故事。",
                      },
                      {
                        value: "trpg",
                        label: "文字冒险 / 跑团 (trpg)",
                        description: "包含检定与选项引导，强调互动。",
                      },
                      {
                        value: "tool",
                        label: "系统与工具 (tool)",
                        description: "纯功能性对话，弱化人设。",
                      },
                    ]}
                  />
                </div>

                {/* 回复模式 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">回复模式</label>
                    <span className="text-[10px] text-muted-foreground">
                      决定回复的文风与详略
                    </span>
                  </div>
                  <RadioGroup
                    value={form.replyMode}
                    onValueChange={(v) => set("replyMode", v)}
                    options={[
                      {
                        value: "casual",
                        label: "轻聊天 (casual)",
                        description: "短平快，纯对话，少描写。",
                      },
                      {
                        value: "immersive",
                        label: "沉浸式扮演 (immersive)",
                        description: "丰富的动作与心理描写。",
                      },
                      {
                        value: "narrator",
                        label: "全知视角 (narrator)",
                        description: "上帝视角描写环境与事件。",
                      },
                    ]}
                  />
                </div>

                {/* AI 回复长度 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">AI 回复长度</label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {form.replyLength} tokens
                    </span>
                  </div>
                  <Slider
                    value={[form.replyLength]}
                    min={100}
                    max={2000}
                    step={50}
                    onValueChange={(v) =>
                      set("replyLength", Array.isArray(v) ? v[0] : v)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    越大回复越详细，但消耗的 token 也越多。100 - 2000，步长 50。
                  </p>
                </div>

                {/* 回复增强 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">回复增强</label>
                    <span className="text-[10px] text-muted-foreground">
                      开启后 AI 会在回复里附带额外信息
                    </span>
                  </div>
                  <RadioGroup
                    value={form.replyEnhancement}
                    onValueChange={(v) => set("replyEnhancement", v)}
                    options={[
                      {
                        value: "none",
                        label: "不开启",
                        description: "普通文字回复。",
                      },
                      {
                        value: "status",
                        label: "状态栏",
                        description: "回复里附带一栏状态（如心情、好感度），随剧情更新。",
                      },
                      {
                        value: "frontend-card",
                        label: "前端卡",
                        description: "用自定义模板 + CSS 把回复渲染成卡片，变量随剧情更新。",
                      },
                    ]}
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    「状态栏」和「前端卡」会让 AI 每次回复都按固定格式输出额外字段，
                    适合喜欢可视化进度的用户。开启后建议在「系统提示词」里补充格式约束。
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scenario">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Theater className="size-4 text-primary" />
                  场景与示例
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field
                  label="对话场景"
                  htmlFor="scenario"
                  hint="故事发生的初始背景，例如：碰巧在公园遇到小明..."
                >
                  <Textarea
                    id="scenario"
                    placeholder="例如：你正在校园的樱花树下长椅上看书，苏暮雨忽然向你走来……"
                    value={form.scenario}
                    onChange={(e) => set("scenario", e.target.value)}
                    rows={6}
                  />
                </Field>

                <div className="h-px bg-border" />

                <Field
                  label="对话示例"
                  htmlFor="dialogueExamples"
                  hint='极其重要！用于规范 AI 的说话口癖和格式。例如：<user>你好</user>\n<char>（微笑）你好呀！</char>'
                >
                  <Textarea
                    id="dialogueExamples"
                    placeholder={
                      "<user>你好</user>\n<char>（微微欠身）你好，旅人。有什么需要我帮忙的吗？</char>\n<user>今天天气真好</user>\n<char>（抬头望向天空）是啊，阳光洒在青石板路上，风里带着花香。</char>"
                    }
                    value={form.dialogueExamples}
                    onChange={(e) =>
                      set("dialogueExamples", e.target.value)
                    }
                    rows={10}
                    className="font-mono text-xs"
                  />
                </Field>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  提示：用 <code className="px-1 rounded bg-muted">&lt;user&gt;</code> 标记用户，
                  <code className="px-1 rounded bg-muted mx-1">&lt;char&gt;</code> 标记角色。
                  多写几组示例能让 AI 更快掌握语气和格式。
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="worldbook">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookText className="size-4 text-primary" />
                  世界书
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  当聊天中出现对应的关键词时，该条设定会自动注入到系统提示词。
                  多个关键词请用 <code className="px-1 rounded bg-muted">英文逗号</code> 分隔。
                </p>

                {form.worldbook.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    还没有条目。点击下方按钮添加第一条设定。
                  </div>
                )}

                {form.worldbook.map((entry, idx) => (
                  <div
                    key={entry._key}
                    className="rounded-lg border border-border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-muted-foreground">
                        条目 {idx + 1}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => removeWorldbookEntry(entry._key)}
                        className="h-6 px-2 text-xs hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                        删除
                      </Button>
                    </div>
                    <Input
                      placeholder="关键词，例如：剑, 雨, 江南"
                      value={entry.keyword}
                      onChange={(e) =>
                        updateWorldbookEntry(entry._key, {
                          keyword: e.target.value,
                        })
                      }
                    />
                    <Textarea
                      placeholder="该条目被命中时注入的设定内容，例如：苏暮雨是江南剑派传人..."
                      value={entry.content}
                      onChange={(e) =>
                        updateWorldbookEntry(entry._key, {
                          content: e.target.value,
                        })
                      }
                      rows={3}
                    />
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addWorldbookEntry}
                  className="w-full"
                >
                  <Plus className="size-4" />
                  添加条目
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <LinkButton href="/" variant="ghost">
            取消
          </LinkButton>
          <Button type="submit" disabled={submitting || isGenerating || importing}>
            <Save className="size-4" />
            {submitting
              ? isEdit
                ? "保存中..."
                : "创建中..."
              : isEdit
              ? "保存修改"
              : "保存并开始聊天"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
      ) : (
        <div className="text-sm font-medium">{label}</div>
      )}
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
