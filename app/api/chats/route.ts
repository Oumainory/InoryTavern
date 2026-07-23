// 聊天会话：POST 创建
// GET 列表 (不必要，已在 /api/characters/[id]/chats 实现)
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateBody {
  characterId: string;
}

export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return new Response("请求体不是合法 JSON", { status: 400 });
  }
  if (!body.characterId) {
    return new Response("characterId 为必填项", { status: 400 });
  }

  const character = await prisma.character.findUnique({
    where: { id: body.characterId },
  });
  if (!character) return new Response("角色不存在", { status: 404 });

  const created = await prisma.chat.create({
    data: {
      characterId: body.characterId,
      messages: "[]",
    },
  });

  return Response.json(
    {
      id: created.id,
      characterId: created.characterId,
      createdAt: created.createdAt.toISOString(),
      messages: [],
    },
    { status: 201 }
  );
}
