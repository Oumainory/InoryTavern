// 某角色的所有会话列表（带摘要）
import { prisma } from "@/lib/prisma";
import type { ChatMessage, ChatSummaryDTO } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function summarize(chat: { id: string; characterId: string; createdAt: Date; messages: string }): ChatSummaryDTO {
  let msgs: ChatMessage[] = [];
  try {
    msgs = JSON.parse(chat.messages);
  } catch {
    msgs = [];
  }
  // 标题：取第一条 user 消息，否则第一条 assistant，再否则"新对话"
  let title = "新对话";
  for (const m of msgs) {
    if (m.role === "user" && m.content) {
      title = m.content.slice(0, 24) + (m.content.length > 24 ? "..." : "");
      break;
    }
  }
  if (title === "新对话") {
    for (const m of msgs) {
      if (m.role === "assistant" && m.content) {
        title = m.content.slice(0, 24) + (m.content.length > 24 ? "..." : "");
        break;
      }
    }
  }
  const last = msgs[msgs.length - 1];
  return {
    id: chat.id,
    characterId: chat.characterId,
    createdAt: chat.createdAt.toISOString(),
    title,
    lastRole: last?.role || null,
    lastContent: last?.content ? last.content.slice(0, 60) : "",
    messageCount: msgs.length,
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const chats = await prisma.chat.findMany({
    where: { characterId: id },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(chats.map(summarize));
}
