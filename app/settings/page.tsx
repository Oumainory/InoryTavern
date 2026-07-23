// 设置页：API Base URL、API Key、聊天/捏卡/语音 模型 + Kokoro TTS 多语言发音人配置
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import {
  ArrowLeft,
  Loader2,
  Play,
  Save,
  Sparkles,
  Eye,
  EyeOff,
  MessageSquare,
  Wand2,
  Volume2,
} from "lucide-react";
import type { SettingDTO } from "@/lib/types";

type ModelField = "chatModel" | "generateModel" | "ttsModel";

const MODEL_FIELDS: {
  key: ModelField;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  hint: string;
}[] = [
  {
    key: "chatModel",
    label: "聊天模型",
    placeholder: "gpt-4o-mini",
    icon: <MessageSquare className="size-3.5" />,
    hint: "用于 /api/chat 流式对话",
  },
  {
    key: "generateModel",
    label: "捏卡模型",
    placeholder: "gpt-4o-mini",
    icon: <Wand2 className="size-3.5" />,
    hint: "用于 /api/generate-character AI 智能捏卡",
  },
  {
    key: "ttsModel",
    label: "语音模型",
    placeholder: "tts-1",
    icon: <Volume2 className="size-3.5" />,
    hint: "用于 /api/tts 语音朗读",
  },
];

// Kokoro TTS 多语言发音人数据
// 顺序对应用户要的"垂直列表"：1.中文 2.英文 3.日文 4.法语 5.西语 6.意语 7.葡语 8.印地语
type KokoroVoiceOption = { id: string; name: string };
type KokoroLanguage = {
  id: string;
  label: string;
  prefix: string[];
  default: string;
  options: KokoroVoiceOption[];
};

const KOKORO_VOICES: KokoroLanguage[] = [
  {
    id: "zh",
    label: "1. 中文 (Chinese)",
    prefix: ["z"],
    default: "zf_xiaobei",
    options: [
      { id: "zf_xiaobei", name: "小贝 (女 - 温柔推荐)" },
      { id: "zf_xiaoni", name: "小妮 (女 - 活泼)" },
      { id: "zf_xiaoxiao", name: "晓晓 (女)" },
      { id: "zf_xiaoyi", name: "小伊 (女)" },
      { id: "zm_yunjian", name: "云健 (男 - 稳重推荐)" },
      { id: "zm_yunxi", name: "云希 (男 - 少年)" },
      { id: "zm_yunxia", name: "云夏 (男)" },
      { id: "zm_yunyang", name: "云扬 (男)" },
    ],
  },
  {
    id: "en",
    label: "2. 英文 (English)",
    prefix: ["a", "b"],
    default: "af_bella",
    options: [
      { id: "af_bella", name: "Bella (美音女 - 推荐)" },
      { id: "af_alloy", name: "Alloy (美音女)" },
      { id: "af_sky", name: "Sky (美音女)" },
      { id: "af_nova", name: "Nova (美音女)" },
      { id: "am_adam", name: "Adam (美音男 - 推荐)" },
      { id: "am_michael", name: "Michael (美音男)" },
      { id: "am_onyx", name: "Onyx (美音男)" },
      { id: "bf_emma", name: "Emma (英音女 - 推荐)" },
      { id: "bm_george", name: "George (英音男 - 推荐)" },
    ],
  },
  {
    id: "ja",
    label: "3. 日文 (Japanese)",
    prefix: ["j"],
    default: "jf_alpha",
    options: [
      { id: "jf_alpha", name: "Alpha (女 - 标准推荐)" },
      { id: "jf_gongitsune", name: "小狐狸 (女 - 俏皮)" },
      { id: "jf_nezumi", name: "老鼠 (女 - 萝莉)" },
      { id: "jm_kumo", name: "云 (男 - 清冷推荐)" },
    ],
  },
  {
    id: "fr",
    label: "4. 法语 (French)",
    prefix: ["f"],
    default: "ff_siwis",
    options: [{ id: "ff_siwis", name: "Siwis (女)" }],
  },
  {
    id: "es",
    label: "5. 西班牙语 (Spanish)",
    prefix: ["e"],
    default: "ef_dora",
    options: [
      { id: "ef_dora", name: "Dora (女)" },
      { id: "em_alex", name: "Alex (男)" },
      { id: "em_santa", name: "Santa (男)" },
    ],
  },
  {
    id: "it",
    label: "6. 意大利语 (Italian)",
    prefix: ["i"],
    default: "if_sara",
    options: [
      { id: "if_sara", name: "Sara (女)" },
      { id: "im_nicola", name: "Nicola (男)" },
    ],
  },
  {
    id: "pt",
    label: "7. 葡萄牙语 (Portuguese)",
    prefix: ["p"],
    default: "pf_dora",
    options: [
      { id: "pf_dora", name: "Dora (女)" },
      { id: "pm_alex", name: "Alex (男)" },
      { id: "pm_santa", name: "Santa (男)" },
    ],
  },
  {
    id: "hi",
    label: "8. 印地语 (Hindi)",
    prefix: ["h"],
    default: "hf_alpha",
    options: [
      { id: "hf_alpha", name: "Alpha (女)" },
      { id: "hf_beta", name: "Beta (女)" },
      { id: "hm_omega", name: "Omega (男)" },
      { id: "hm_psi", name: "Psi (男)" },
    ],
  },
];

// 把逗号分隔的字符串解析成 Record<langId, voiceId>
// 没匹配上的语言用默认
function parseVoicesFromStr(str: string): Record<string, string> {
  const saved = str
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const out: Record<string, string> = {};
  KOKORO_VOICES.forEach((lang) => {
    const matched = saved.find((v) => lang.prefix.some((p) => v.startsWith(p)));
    out[lang.id] = matched || lang.default;
  });
  return out;
}

// voices 对象 → 逗号分隔字符串
function serializeVoices(v: Record<string, string>): string {
  return KOKORO_VOICES.map((lang) => v[lang.id] || lang.default)
    .filter(Boolean)
    .join(", ");
}

// 试听台词：8 种语言
const PREVIEW_TEXTS: Record<string, string> = {
  zh: "你好，我是你的 InoryTavern 语音。",
  en: "Hello, I am your tavern voice.",
  ja: "こんにちは、私はあなたの酒場の声です。",
  fr: "Bonjour, je suis la voix de votre taverne.",
  es: "Hola, soy la voz de tu taberna.",
  it: "Ciao, sono la voce della tua taverna.",
  pt: "Olá, sou a voz da sua taverna.",
  hi: "नमस्ते, मैं आपकी सराय की आवाज़ हूँ।",
};

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelValues, setModelValues] = useState<Record<ModelField, string>>({
    chatModel: "",
    generateModel: "",
    ttsModel: "",
  });
  // TTS 多语言发音人：{ langId: voiceId }
  const [voices, setVoices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    KOKORO_VOICES.forEach((lang) => (init[lang.id] = lang.default));
    return init;
  });
  // 试听播放状态：当前正在播放的语言 id（同时只能一个）
  const [playingId, setPlayingId] = useState<string | null>(null);
  // 试听错误信息
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showKey, setShowKey] = useState(false);

  // 初次加载：拉取当前 setting
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/settings", { cache: "no-store" });
        if (r.ok) {
          const data: SettingDTO = await r.json();
          setBaseUrl(data.baseUrl);
          setApiKey(data.apiKey);
          setApiKeyMasked(data.apiKeyMasked);
          setModelValues({
            chatModel: data.chatModel,
            generateModel: data.generateModel,
            ttsModel: data.ttsModel,
          });
          if (data.ttsVoice) {
            setVoices(parseVoicesFromStr(data.ttsVoice));
          } else {
            // 默认值
            const def: Record<string, string> = {};
            KOKORO_VOICES.forEach((lang) => (def[lang.id] = lang.default));
            setVoices(def);
          }
        }
      } catch (err) {
        setError("加载设置失败：" + (err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onFetchModels = async () => {
    setError(null);
    setOkMsg(null);
    setFetching(true);
    try {
      // 先保存当前输入，再拉模型（避免 baseUrl 改了但 DB 没改）
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey }),
      });
      const r = await fetch("/api/models", { cache: "no-store" });
      let json: { data?: { id: string }[]; error?: string } = {};
      const text = await r.text();
      try {
        json = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error(`解析接口响应失败 (HTTP ${r.status})，响应内容截断：${text.slice(0, 100)}`);
      }

      if (!r.ok) {
        setError(json.error || `拉取失败 (${r.status}): ${text.slice(0, 100)}`);
        setModels([]);
        return;
      }
      const ids = (json.data || []).map((m) => m.id).sort();
      setModels(ids);
      setOkMsg(`已获取 ${ids.length} 个模型`);
      // 把当前不在列表里的值保留到列表里
      setModelValues((prev) => {
        const next = { ...prev };
        (Object.keys(prev) as ModelField[]).forEach((k) => {
          if (prev[k] && !ids.includes(prev[k])) {
            // 保持现状，只是确保下拉框可显示
          }
        });
        return next;
      });
    } catch (err) {
      setError("拉取失败：" + (err as Error).message);
    } finally {
      setFetching(false);
    }
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    setSaving(true);
    try {
      const ttsVoiceStr = serializeVoices(voices);
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          apiKey,
          chatModel: modelValues.chatModel,
          generateModel: modelValues.generateModel,
          ttsModel: modelValues.ttsModel,
          ttsVoice: ttsVoiceStr,
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "保存失败");
      }
      const data: SettingDTO = await r.json();
      setApiKeyMasked(data.apiKeyMasked);
      setModelValues({
        chatModel: data.chatModel,
        generateModel: data.generateModel,
        ttsModel: data.ttsModel,
      });
      if (data.ttsVoice) {
        setVoices(parseVoicesFromStr(data.ttsVoice));
      }
      setOkMsg("已保存");
      setTimeout(() => setOkMsg(null), 2000);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // 试听播放：调用 /api/tts 合成当前语言 + 当前选中 voice
  // 该接口是非 Kokoro 时接收 { text, voice }；Kokoro 时由后端根据文本语言自动匹配 voice（我们显式传 voice 提示预期音色）
  const handlePreview = async (langId: string, voiceId: string) => {
    if (playingId) return; // 已有播放中，忽略
    setPreviewError(null);
    setPlayingId(langId);
    try {
      const text = PREVIEW_TEXTS[langId] || PREVIEW_TEXTS["en"];
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceId }),
      });
      if (!response.ok) {
        let msg = "TTS 请求失败";
        try {
          const j = await response.json();
          if (j?.error) msg = j.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      // 停掉之前的 audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingId(null);
        URL.revokeObjectURL(audioUrl);
        if (audioRef.current === audio) audioRef.current = null;
      };
      audio.onerror = () => {
        setPlayingId(null);
        URL.revokeObjectURL(audioUrl);
        if (audioRef.current === audio) audioRef.current = null;
      };
      await audio.play();
    } catch (err) {
      setPreviewError((err as Error).message);
      setPlayingId(null);
    }
  };

  // 卸载时清理
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          正在加载...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <LinkButton href="/" variant="ghost" size="icon" aria-label="返回">
          <ArrowLeft className="size-4" />
        </LinkButton>
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            设置
          </h1>
          <p className="text-sm text-muted-foreground">
            配置兼容 OpenAI 格式的第三方 API 接入。
          </p>
        </div>
      </div>

      <form onSubmit={onSave}>
        <Card>
          <CardHeader>
            <CardTitle>API 配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="baseUrl" className="text-sm font-medium">
                API Base URL
              </label>
              <Input
                id="baseUrl"
                type="url"
                placeholder="https://api.openai.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                兼容 OpenAI Chat Completions 格式的服务地址。
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="apiKey" className="text-sm font-medium">
                API Key
              </label>
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  type={showKey ? "text" : "password"}
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKey((v) => !v)}
                  title={showKey ? "隐藏" : "显示"}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              {apiKeyMasked && (
                <p className="text-xs text-muted-foreground">
                  当前已保存：<span className="font-mono">{apiKeyMasked}</span>
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onFetchModels}
                disabled={fetching}
              >
                {fetching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                获取模型列表
              </Button>
            </div>

            {/* 三个模型下拉框 */}
            <div className="grid gap-4 pt-2 border-t border-border/60">
              {MODEL_FIELDS.map((f) => {
                const v = modelValues[f.key];
                const inList = v && models.includes(v);
                return (
                  <div key={f.key} className="space-y-1.5">
                    <label
                      htmlFor={f.key}
                      className="text-sm font-medium flex items-center gap-1.5"
                    >
                      <span className="text-muted-foreground">{f.icon}</span>
                      {f.label}
                    </label>
                    {models.length > 0 ? (
                      <select
                        id={f.key}
                        value={v}
                        onChange={(e) =>
                          setModelValues((s) => ({ ...s, [f.key]: e.target.value }))
                        }
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {!inList && v && (
                          <option value={v}>
                            {v} (当前)
                          </option>
                        )}
                        {models.map((id) => (
                          <option key={id} value={id}>
                            {id}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={f.key}
                        placeholder={f.placeholder}
                        value={v}
                        onChange={(e) =>
                          setModelValues((s) => ({ ...s, [f.key]: e.target.value }))
                        }
                        required
                      />
                    )}
                    <p className="text-xs text-muted-foreground">{f.hint}</p>
                  </div>
                );
              })}

              {/* Kokoro TTS 多语言发音人配置（垂直列表） */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <Volume2 className="size-3.5 text-muted-foreground" />
                  🔊 TTS 多语言发音人配置
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/40 p-4 rounded-lg border border-border">
                  {KOKORO_VOICES.map((lang) => {
                    const currentVoice = voices[lang.id] || lang.default;
                    const isPlaying = playingId === lang.id;
                    return (
                      <div key={lang.id} className="flex flex-col space-y-1">
                        <label
                          htmlFor={`voice-${lang.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          {lang.label}
                        </label>
                        <div className="flex items-center space-x-2">
                          <select
                            id={`voice-${lang.id}`}
                            value={currentVoice}
                            onChange={(e) =>
                              setVoices((v) => ({ ...v, [lang.id]: e.target.value }))
                            }
                            className="flex-1 p-2 text-sm border rounded-md bg-background border-input focus:ring-2 focus:ring-primary outline-none"
                          >
                            {lang.options.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handlePreview(lang.id, currentVoice)}
                            disabled={playingId !== null}
                            title="试听声音"
                            aria-label={`试听 ${lang.label}`}
                            className="p-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isPlaying ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {previewError && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    试听失败：{previewError}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  提示：系统会根据对话文本的语言自动切换发音人。例如中文对话使用中文发音人，遇到英文单词自动切换为英文发音人。
                </p>
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

            <div className="flex items-center justify-end gap-2 pt-2">
              <LinkButton href="/" variant="ghost">
                取消
              </LinkButton>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {saving ? "保存中..." : "保存配置"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
