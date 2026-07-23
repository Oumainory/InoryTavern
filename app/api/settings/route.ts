// 全局设置（单例：id = "global"）
// GET: 读取当前配置
// POST: 更新配置
import { prisma } from "@/lib/prisma";
import type { SettingDTO } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SettingRow = {
  id: string;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  generateModel: string;
  ttsModel: string;
  ttsVoice: string;
};

// 懒加载：首次访问时如果不存在，则创建默认值
async function getOrCreateSetting(): Promise<SettingRow> {
  let s = await prisma.setting.findUnique({ where: { id: "global" } });
  if (!s) {
    s = await prisma.setting.create({
      data: {
        id: "global",
        baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY || "",
        chatModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
        generateModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
        ttsModel: process.env.OPENAI_TTS_MODEL || "tts-1",
        ttsVoice: process.env.OPENAI_TTS_VOICE || "",
      },
    });
  }
  return s as SettingRow;
}

function toDTO(s: SettingRow): SettingDTO {
  // apiKey 用于回显时脱敏：保留前 4 后 4
  const k = s.apiKey || "";
  let masked = "";
  if (k.length <= 8) {
    masked = k ? "•".repeat(k.length) : "";
  } else {
    masked = `${k.slice(0, 4)}${"•".repeat(Math.max(0, k.length - 8))}${k.slice(-4)}`;
  }
  return {
    id: s.id,
    baseUrl: s.baseUrl,
    apiKey: s.apiKey,
    apiKeyMasked: masked,
    chatModel: s.chatModel,
    generateModel: s.generateModel,
    ttsModel: s.ttsModel,
    ttsVoice: s.ttsVoice,
  };
}

export async function GET() {
  const s = await getOrCreateSetting();
  return Response.json(toDTO(s));
}

interface UpdateBody {
  baseUrl?: string;
  apiKey?: string;
  chatModel?: string;
  generateModel?: string;
  ttsModel?: string;
  ttsVoice?: string;
}

export async function POST(req: Request) {
  let body: UpdateBody;
  try {
    body = await req.json();
  } catch {
    return new Response("请求体不是合法 JSON", { status: 400 });
  }

  const data: UpdateBody = {};
  if (typeof body.baseUrl === "string" && body.baseUrl.trim()) {
    data.baseUrl = body.baseUrl.trim();
  }
  if (typeof body.apiKey === "string") {
    // 允许空字符串（清空）；不允许 undefined
    data.apiKey = body.apiKey.trim();
  }
  if (typeof body.chatModel === "string" && body.chatModel.trim()) {
    data.chatModel = body.chatModel.trim();
  }
  if (typeof body.generateModel === "string" && body.generateModel.trim()) {
    data.generateModel = body.generateModel.trim();
  }
  if (typeof body.ttsModel === "string" && body.ttsModel.trim()) {
    data.ttsModel = body.ttsModel.trim();
  }
  if (typeof body.ttsVoice === "string") {
    // 允许空字符串（清空），不允许 undefined
    data.ttsVoice = body.ttsVoice.trim();
  }

  // 确保存在
  await getOrCreateSetting();
  const updated = await prisma.setting.update({
    where: { id: "global" },
    data,
  });

  return Response.json(toDTO(updated as SettingRow));
}
