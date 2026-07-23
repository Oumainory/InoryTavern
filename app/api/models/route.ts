// 模型列表：调用 ${baseUrl}/models
// GET /api/models
// 读取数据库中的 baseUrl / apiKey，转发到该地址的 /models 端点。
// 返回 { data: Model[] }，其中 Model 至少包含 id 字段。
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const setting = await prisma.setting.findUnique({ where: { id: "global" } });
  const baseUrl =
    (setting?.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
      /\/+$/,
      ""
    );
  const apiKey = setting?.apiKey || process.env.OPENAI_API_KEY || "";

  if (!apiKey) {
    return Response.json(
      {
        error:
          "未配置 API Key：请先在「设置」页或 .env 中填写 OPENAI_API_KEY",
        data: [],
      },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // 中转 API 偶尔很慢，给 15s
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json(
        {
          error: `上游返回 ${res.status}：${text.slice(0, 200)}`,
          data: [],
        },
        { status: res.status }
      );
    }

    const rawText = await res.text();
    let json: { data?: Array<{ id: string; [k: string]: unknown }> };
    try {
      json = JSON.parse(rawText);
    } catch (parseErr) {
      return Response.json(
        {
          error: `上游返回的不是合法 JSON。内容：${rawText.slice(0, 100)}`,
          data: [],
        },
        { status: 502 }
      );
    }

    // OpenAI 格式: { data: [{id, ...}, ...] }
    const models = Array.isArray(json.data) ? json.data : [];
    // 仅保留 id 字段，简化前端
    const simplified = models
      .map((m) => ({ id: m.id }))
      .filter((m) => typeof m.id === "string" && m.id.length > 0);

    return Response.json({ data: simplified, baseUrl });
  } catch (err) {
    const msg = (err as Error).message || String(err);
    return Response.json(
      {
        error: `请求失败：${msg}`,
        data: [],
      },
      { status: 500 }
    );
  }
}
