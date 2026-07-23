// 聊天记录的"重新生成"操作：删除最后一条 assistant 消息
import { prisma } from "@/lib/prisma";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/chats/[id]/regenerate
// 作用：删除该 chat 中最后一条 assistant 消息，返回剩余 messages
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const chat = await prisma.chat.findUnique({ where: { id } });
  if (!chat) return new Response("会话不存在", { status: 404 });

  let messages: ChatMessage[] = [];
  try {
    messages = JSON.parse(chat.messages);
  } catch {
    messages = [];
  }

  // 从后向前找到最后一条 assistant 消息并删除
  let removed = false;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      messages.splice(i, 1);
      removed = true;
      break;
    }
  }

  if (removed) {
    await prisma.chat.update({
      where: { id },
      data: { messages: JSON.stringify(messages) },
    });
  }

  return Response.json({
    ok: true,
    removed,
    messages,
  });
}
