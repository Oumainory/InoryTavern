// RAG 长期记忆管理 API
// GET    /api/memories?characterId=xxx          列出该角色所有记忆（不含 embedding）
// POST   /api/memories                          body: { characterId, content }    手动添加一条记忆
// DELETE /api/memories                          body: { id }                       删除一条记忆
import { prisma } from "@/lib/prisma";
import { saveMemory } from "@/lib/vector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const characterId = searchParams.get("characterId");
  if (!characterId) {
    return new Response("characterId 必填", { status: 400 });
  }
  try {
    const rows = await prisma.memory.findMany({
      where: { characterId },
      orderBy: { createdAt: "desc" },
      select: { id: true, content: true, chatId: true, createdAt: true },
    });
    return Response.json({
      data: rows.map((r) => ({
        id: r.id,
        content: r.content,
        chatId: r.chatId,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

interface CreateBody {
  characterId?: string;
  content?: string;
  chatId?: string | null;
}

export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return new Response("请求体不是合法 JSON", { status: 400 });
  }
  const characterId = (body.characterId || "").trim();
  const content = (body.content || "").trim();
  if (!characterId) {
    return new Response("characterId 必填", { status: 400 });
  }
  if (!content) {
    return new Response("content 不能为空", { status: 400 });
  }
  // 验证角色存在
  const exists = await prisma.character.findUnique({
    where: { id: characterId },
    select: { id: true },
  });
  if (!exists) {
    return new Response("角色不存在", { status: 404 });
  }
  try {
    const row = await saveMemory(characterId, content, body.chatId || null);
    return Response.json({ ok: true, id: row.id });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

interface DeleteBody {
  id?: string;
}

export async function DELETE(req: Request) {
  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return new Response("请求体不是合法 JSON", { status: 400 });
  }
  const id = (body.id || "").trim();
  if (!id) {
    return new Response("id 必填", { status: 400 });
  }
  try {
    await prisma.memory.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return new Response("记忆不存在", { status: 404 });
  }
}
