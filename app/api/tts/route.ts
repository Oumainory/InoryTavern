// 文本转语音 API
// POST /api/tts
// body: { text: string, voice?: string }
// response: audio/mpeg binary
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReqBody {
  text?: string;
  voice?: string;
}

/**
 * 智能选择 voice：
 * - 非 Kokoro 模型：直接用请求中的 voice（默认 alloy）
 * - Kokoro 模型：根据文本语言自动从用户提供的 voice 列表中匹配
 *   用户可在「设置」中填入多个 voice ID（用逗号分隔），如 "zm_yunjian, am_adam, jm_kumo"
 *   系统会按语言匹配：中文找 zf_/zm_，英文找 af_/am_/bf_/bm_，日文找 jf_/jm_ 等
 */
function getSmartVoice(text: string, model: string, userVoiceStr: string = "alloy") {
  if (!model.toLowerCase().includes("kokoro")) {
    return userVoiceStr.split(",")[0].trim() || "alloy";
  }

  // 解析用户提供的 voice 列表
  const userVoices = userVoiceStr
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v);

  // 辅助函数：根据前缀从用户列表中寻找匹配的 voice
  const findVoiceByPrefix = (prefixes: string[]) => {
    return userVoices.find((v) => prefixes.some((prefix) => v.startsWith(prefix)));
  };

  const lowerText = text.toLowerCase();

  // 1. 日文检测
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return findVoiceByPrefix(["jf_", "jm_"]) || "jf_alpha";
  }

  // 2. 中文检测
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return findVoiceByPrefix(["zf_", "zm_"]) || "zf_xiaobei";
  }

  // 3. 印地语检测
  if (/[\u0900-\u097F]/.test(text)) {
    return findVoiceByPrefix(["hf_", "hm_"]) || "hf_alpha";
  }

  // 4. 法语检测
  if (
    /[œæ]/.test(lowerText) ||
    /\b(est|qui|que|je|tu|il|elle|nous|vous|ils|elles)\b/.test(lowerText)
  ) {
    const frWeight = (
      lowerText.match(/\b(est|qui|que|je|tu|il|elle|nous|vous|ils|elles)\b/g) || []
    ).length;
    const enWeight = (
      lowerText.match(/\b(the|is|are|you|we|they|he|she|it|and)\b/g) || []
    ).length;
    if (frWeight > enWeight)
      return findVoiceByPrefix(["ff_", "fm_"]) || "ff_siwis";
  }

  // 5. 西班牙语检测
  if (
    /[¿¡]/.test(lowerText) ||
    /\b(el|la|los|las|un|una|unos|unas|y|en|que|por|para|con)\b/.test(lowerText)
  ) {
    const esWeight = (
      lowerText.match(/\b(el|la|los|las|un|una|unos|unas|y|en|que|por|para|con)\b/g) || []
    ).length;
    const enWeight = (
      lowerText.match(/\b(the|is|are|you|we|they|he|she|it|and)\b/g) || []
    ).length;
    if (esWeight > enWeight)
      return findVoiceByPrefix(["ef_", "em_"]) || "ef_dora";
  }

  // 6. 意大利语检测
  if (/\b(il|lo|la|i|gli|le|un|uno|una|un'|di|a|da|in|con|su|per|tra|fra)\b/.test(lowerText)) {
    const itWeight = (
      lowerText.match(
        /\b(il|lo|la|i|gli|le|un|uno|una|un'|di|a|da|in|con|su|per|tra|fra)\b/g
      ) || []
    ).length;
    const enWeight = (
      lowerText.match(/\b(the|is|are|you|we|they|he|she|it|and)\b/g) || []
    ).length;
    if (itWeight > enWeight)
      return findVoiceByPrefix(["if_", "im_"]) || "if_sara";
  }

  // 7. 葡萄牙语检测
  if (/\b(o|a|os|as|um|uma|uns|umas|e|em|que|por|para|com|não)\b/.test(lowerText)) {
    const ptWeight = (
      lowerText.match(/\b(o|a|os|as|um|uma|uns|umas|e|em|que|por|para|com|não)\b/g) || []
    ).length;
    const enWeight = (
      lowerText.match(/\b(the|is|are|you|we|they|he|she|it|and)\b/g) || []
    ).length;
    if (ptWeight > enWeight)
      return findVoiceByPrefix(["pf_", "pm_"]) || "pf_dora";
  }

  // 8. 默认英文
  return findVoiceByPrefix(["af_", "am_", "bf_", "bm_"]) || "af_alloy";
}

/**
 * Kokoro voice ID 首字母 → lang 代码映射。
 * Kokoro API 通常用 lang 参数指定发音字典，不传或传错会导致"串台"。
 * 映射表按 Kokoro 官方约定：
 *   'a'/'b' → en（英文），'z' → zh（中文），'j' → ja（日语）
 *   'h' → hi（印地），'f' → fr（法语），'e' → es（西语）
 *   'i' → it（意语），'p' → pt（葡语），其余默认 en
 */
function voiceToLang(voiceId: string): string {
  const prefix = (voiceId || "")[0]?.toLowerCase() || "";
  const map: Record<string, string> = {
    a: "en",
    b: "en",
    z: "zh",
    j: "ja",
    h: "hi",
    f: "fr",
    e: "es",
    i: "it",
    p: "pt",
  };
  return map[prefix] || "en";
}

export async function POST(req: Request) {
  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return new Response("请求体不是合法 JSON", { status: 400 });
  }

  const text = (body.text || "").trim();
  if (!text) {
    return new Response("text 不能为空", { status: 400 });
  }
  if (text.length > 4096) {
    return new Response("text 超过 4096 字符上限", { status: 400 });
  }

  // 读 DB Setting
  const setting = await prisma.setting.findUnique({ where: { id: "global" } });
  const apiKey = setting?.apiKey || process.env.OPENAI_API_KEY || "";
  const baseURL =
    setting?.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = setting?.ttsModel || process.env.OPENAI_TTS_MODEL || "tts-1";

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "未配置 API Key：请在「设置」页填写，或在 .env 中设置 OPENAI_API_KEY",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 试听模式（body.voice 有值）：直接用指定的 voice，lang 由 voice 首字母推断，
  // 完全跳过文本语种检测，杜绝"串台"。
  // 聊天模式（body.voice 为空）：走原有 getSmartVoice 自动匹配。
  let finalVoice: string;
  let finalLang: string | undefined;

  if (body.voice?.trim()) {
    finalVoice = body.voice.trim();
    finalLang = voiceToLang(finalVoice);
  } else {
    const userVoiceStr = (setting as { ttsVoice?: string } | null)?.ttsVoice?.trim() || "alloy";
    finalVoice = getSmartVoice(text, model, userVoiceStr);
    // 自动模式下也推导 lang，保证 Kokoro 用对发音字典
    finalLang = voiceToLang(finalVoice);
  }

  const client = new OpenAI({ apiKey, baseURL });

  try {
    // Kokoro（kokoro）支持 extra_body 传 lang；标准 OpenAI TTS 不支持，忽略即可
    const extraBody: Record<string, unknown> = {};
    if (model.toLowerCase().includes("kokoro") && finalLang) {
      extraBody.lang = finalLang;
    }

    const speech = await client.audio.speech.create({
      model,
      voice: finalVoice as
        | "alloy"
        | "echo"
        | "fable"
        | "onyx"
        | "nova"
        | "shimmer"
        | "ash"
        | "ballad"
        | "coral"
        | "sage"
        | "verse"
        | "marin"
        | string,
      input: text,
      ...(Object.keys(extraBody).length > 0 ? { extra_body: extraBody } : {}),
    });
    const buf = await speech.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = (err as Error).message || String(err);
    return new Response(
      JSON.stringify({ error: `语音合成失败：${msg}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
