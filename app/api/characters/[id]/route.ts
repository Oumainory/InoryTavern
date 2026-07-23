// 单个角色：GET / PUT / DELETE
import { prisma } from "@/lib/prisma";
import type { CharacterDTO, WorldbookEntryDTO } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

interface UpdateBody {
  name?: string;
  avatar?: string | null;
  description?: string;
  personality?: string | null;
  firstMessage?: string | null;
  systemPrompt?: string | null;
  isNsfw?: boolean;
  worldbook?: { keyword: string; content: string }[];
  // ----- 高级角色设定 -----
  userCharacterName?: string | null;
  playStyle?: string | null;
  replyMode?: string | null;
  replyLength?: number | null;
  dialogueExamples?: string | null;
  scenario?: string | null;
  replyEnhancement?: string | null;
}

function toDTO(c: {
  id: string;
  name: string;
  avatar: string | null;
  description: string;
  personality: string | null;
  firstMessage: string | null;
  systemPrompt: string | null;
  isNsfw: boolean;
  createdAt: Date;
  userCharacterName: string | null;
  playStyle: string | null;
  replyMode: string | null;
  replyLength: number | null;
  dialogueExamples: string | null;
  scenario: string | null;
  replyEnhancement: string | null;
  worldbookEntries: { id: string; keyword: string; content: string }[];
}): CharacterDTO {
  return {
    id: c.id,
    name: c.name,
    avatar: c.avatar,
    description: c.description,
    personality: c.personality,
    firstMessage: c.firstMessage,
    systemPrompt: c.systemPrompt,
    isNsfw: c.isNsfw,
    createdAt: c.createdAt.toISOString(),
    userCharacterName: c.userCharacterName,
    playStyle: c.playStyle,
    replyMode: c.replyMode,
    replyLength: c.replyLength,
    dialogueExamples: c.dialogueExamples,
    scenario: c.scenario,
    replyEnhancement: c.replyEnhancement,
    worldbook: c.worldbookEntries.map(
      (w): WorldbookEntryDTO => ({
        id: w.id,
        keyword: w.keyword,
        content: w.content,
      })
    ),
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const c = await prisma.character.findUnique({
    where: { id },
    include: { worldbookEntries: { orderBy: { createdAt: "asc" } } },
  });
  if (!c) return new Response("角色不存在", { status: 404 });
  return Response.json(toDTO(c));
}

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: UpdateBody;
  try {
    body = await req.json();
  } catch {
    return new Response("请求体不是合法 JSON", { status: 400 });
  }

  if (body.name !== undefined && !body.name.trim()) {
    return new Response("name 不能为空", { status: 400 });
  }
  if (body.description !== undefined && !body.description.trim()) {
    return new Response("description 不能为空", { status: 400 });
  }

  // 校验角色存在
  const exists = await prisma.character.findUnique({ where: { id } });
  if (!exists) return new Response("角色不存在", { status: 404 });

  // 准备 update 数据
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (body.avatar !== undefined) data.avatar = body.avatar || null;
  if (typeof body.description === "string")
    data.description = body.description.trim();
  if (body.personality !== undefined)
    data.personality = body.personality || null;
  if (body.firstMessage !== undefined)
    data.firstMessage = body.firstMessage || null;
  if (body.systemPrompt !== undefined)
    data.systemPrompt = body.systemPrompt || null;
  if (typeof body.isNsfw === "boolean") data.isNsfw = body.isNsfw;
  // ----- 高级角色设定 -----
  if (body.userCharacterName !== undefined)
    data.userCharacterName = body.userCharacterName || null;
  if (body.playStyle !== undefined)
    data.playStyle = body.playStyle || "1v1";
  if (body.replyMode !== undefined)
    data.replyMode = body.replyMode || "immersive";
  if (body.replyLength !== undefined) {
    data.replyLength =
      typeof body.replyLength === "number" && body.replyLength > 0
        ? Math.round(body.replyLength)
        : 500;
  }
  if (body.dialogueExamples !== undefined)
    data.dialogueExamples = body.dialogueExamples || null;
  if (body.scenario !== undefined) data.scenario = body.scenario || null;
  if (body.replyEnhancement !== undefined)
    data.replyEnhancement = body.replyEnhancement || "none";

  // 全量更新 WorldbookEntry：事务里先删旧的，再插新的
  const worldbook = (body.worldbook || [])
    .map((e) => ({
      keyword: (e.keyword || "").trim(),
      content: (e.content || "").trim(),
    }))
    .filter((e) => e.keyword && e.content);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.worldbookEntry.deleteMany({ where: { characterId: id } });
    return tx.character.update({
      where: { id },
      data: {
        ...data,
        worldbookEntries: {
          create: worldbook.map((w) => ({
            keyword: w.keyword,
            content: w.content,
          })),
        },
      },
      include: { worldbookEntries: { orderBy: { createdAt: "asc" } } },
    });
  });

  return Response.json(toDTO(updated));
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await prisma.character.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return new Response("角色不存在", { status: 404 });
  }
}
