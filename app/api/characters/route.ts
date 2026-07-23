// 角色 CRUD：GET 列表 / POST 创建
import { prisma } from "@/lib/prisma";
import type { CharacterDTO, WorldbookEntryDTO } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const list = await prisma.character.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      worldbookEntries: { orderBy: { createdAt: "asc" } },
    },
  });
  const data: CharacterDTO[] = list.map((c) => ({
    id: c.id,
    name: c.name,
    avatar: c.avatar,
    description: c.description,
    personality: c.personality,
    firstMessage: c.firstMessage,
    systemPrompt: c.systemPrompt,
    isNsfw: c.isNsfw,
    createdAt: c.createdAt.toISOString(),
    worldbook: c.worldbookEntries.map(
      (w): WorldbookEntryDTO => ({
        id: w.id,
        keyword: w.keyword,
        content: w.content,
      })
    ),
  }));
  return Response.json(data);
}

export async function POST(req: Request) {
  let body: Partial<CharacterDTO> & { worldbook?: { keyword: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return new Response("请求体不是合法 JSON", { status: 400 });
  }

  if (!body.name || !body.description) {
    return new Response("name 和 description 为必填项", { status: 400 });
  }

  const worldbook = (body.worldbook || [])
    .map((e) => ({
      keyword: (e.keyword || "").trim(),
      content: (e.content || "").trim(),
    }))
    .filter((e) => e.keyword && e.content);

  const created = await prisma.character.create({
    data: {
      name: body.name,
      avatar: body.avatar || null,
      description: body.description,
      personality: body.personality || null,
      firstMessage: body.firstMessage || null,
      systemPrompt: body.systemPrompt || null,
      isNsfw: !!body.isNsfw,
      worldbookEntries: {
        create: worldbook.map((w) => ({
          keyword: w.keyword,
          content: w.content,
        })),
      },
    },
    include: { worldbookEntries: true },
  });

  return Response.json(
    {
      id: created.id,
      name: created.name,
      avatar: created.avatar,
      description: created.description,
      personality: created.personality,
      firstMessage: created.firstMessage,
      systemPrompt: created.systemPrompt,
      isNsfw: created.isNsfw,
      createdAt: created.createdAt.toISOString(),
      worldbook: created.worldbookEntries.map((w) => ({
        id: w.id,
        keyword: w.keyword,
        content: w.content,
      })),
    },
    { status: 201 }
  );
}
