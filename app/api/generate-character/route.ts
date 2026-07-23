// AI 智能捏卡：根据用户一句话描述，生成完整角色设定
// POST /api/generate-character
// body: { prompt: string }
// response: { ok: true, data: { name, description, personality, firstMessage, systemPrompt, worldbook } }
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_INSTRUCTION = `你是一个专业的角色扮演卡片生成器。请根据用户的描述，生成一个完整的角色设定。
你必须且只能输出一个合法的 JSON 对象，不要包含任何 markdown 代码块标记，不要有任何额外说明。
JSON 格式如下：
{
  "name": "角色名字",
  "description": "一句话简介",
  "personality": "性格特点描述",
  "firstMessage": "符合人设的第一句开场白对话",
  "systemPrompt": "详细的系统提示词（包含行为准则、人设细节等）",
  "worldbook": [
    { "keyword": "关键词1,关键词2", "content": "相关的世界观或背景设定" }
  ]
}`;

interface ReqBody {
  prompt?: string;
}

interface GeneratedCharacter {
  name: string;
  description: string;
  personality: string;
  firstMessage: string;
  systemPrompt: string;
  worldbook: { keyword: string; content: string }[];
}

export async function POST(req: Request) {
  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return new Response("请求体不是合法 JSON", { status: 400 });
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt) {
    return new Response("prompt 不能为空", { status: 400 });
  }

  // 读 DB Setting
  const setting = await prisma.setting.findUnique({ where: { id: "global" } });
  const apiKey = setting?.apiKey || process.env.OPENAI_API_KEY || "";
  const baseURL = setting?.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  // 智能捏卡专用模型
  const model = setting?.generateModel || process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    return Response.json(
      {
        error:
          "未配置 API Key：请先在「设置」页填写，或在 .env 中设置 OPENAI_API_KEY",
      },
      { status: 400 }
    );
  }

  const client = new OpenAI({ apiKey, baseURL });

  try {
    // 使用非流式响应：因为我们要完整解析 JSON
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      // 强制 JSON 模式（如模型支持）
      response_format: { type: "json_object" } as never,
    });

    const raw =
      completion.choices?.[0]?.message?.content?.trim() || "";

    if (!raw) {
      return Response.json(
        { error: "模型返回为空" },
        { status: 502 }
      );
    }

    const parsed = extractJson(raw);
    if (!parsed) {
      return Response.json(
        { error: `无法从模型输出中解析 JSON：${raw.slice(0, 200)}` },
        { status: 502 }
      );
    }

    // 归一化字段
    const data: GeneratedCharacter = normalize(parsed);

    return Response.json({ ok: true, data });
  } catch (err) {
    const msg = (err as Error).message || String(err);
    return Response.json(
      { error: `调用模型失败：${msg}` },
      { status: 500 }
    );
  }
}

// 从模型输出中提取 JSON 字符串。
// 处理以下情况：
//  1. 纯净的 {...}
//  2. 包了 ```json ... ``` 或 ``` ... ```
//  3. 前面有"以下是..."等自然语言
//  4. 整个响应里有非 JSON 文本
function extractJson(text: string): unknown | null {
  // 1) 去掉 markdown 代码块标记
  let s = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // 2) 尝试直接 parse
  try {
    return JSON.parse(s);
  } catch {
    // fallthrough
  }

  // 3) 找第一个 { 到最后一个 } 的范围再 parse
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const slice = s.slice(first, last + 1);
    try {
      return JSON.parse(slice);
    } catch {
      // fallthrough
    }
  }

  // 4) 暴力：把所有换行外的空白清掉再试
  try {
    return JSON.parse(s.replace(/\s*\n\s*/g, " "));
  } catch {
    return null;
  }
}

function normalize(obj: unknown): GeneratedCharacter {
  const o = obj as Record<string, unknown>;
  const s = (k: string): string =>
    typeof o[k] === "string" ? (o[k] as string) : "";
  const worldbookRaw = Array.isArray(o.worldbook) ? o.worldbook : [];
  const worldbook = worldbookRaw
    .map((w) => {
      const ww = w as Record<string, unknown>;
      return {
        keyword: typeof ww.keyword === "string" ? ww.keyword : "",
        content: typeof ww.content === "string" ? ww.content : "",
      };
    })
    .filter((w) => w.keyword && w.content);

  return {
    name: s("name").slice(0, 40),
    description: s("description"),
    personality: s("personality"),
    firstMessage: s("firstMessage"),
    systemPrompt: s("systemPrompt"),
    worldbook,
  };
}
