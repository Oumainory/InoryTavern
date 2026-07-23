// 聊天记录：GET / PUT
import { prisma } from "@/lib/prisma";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const chat = await prisma.chat.findUnique({ where: { id } });
  if (!chat) return new Response("会话不存在", { status: 404 });

  let messages: ChatMessage[] = [];
  try {
    messages = JSON.parse(chat.messages);
  } catch {
    messages = [];
  }

  return Response.json({
    id: chat.id,
    characterId: chat.characterId,
    messages,
    createdAt: chat.createdAt.toISOString(),
  });
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: { messages: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return new Response("请求体不是合法 JSON", { status: 400 });
  }
  if (!Array.isArray(body.messages)) {
    return new Response("messages 必须是数组", { status: 400 });
  }

  try {
    const updated = await prisma.chat.update({
      where: { id },
      data: { messages: JSON.stringify(body.messages) },
    });
    return Response.json({ ok: true, updatedAt: updated.createdAt });
  } catch {
    return new Response("会话不存在", { status: 404 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await prisma.chat.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return new Response("会话不存在", { status: 404 });
  }
}
