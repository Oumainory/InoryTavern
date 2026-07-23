// 编辑角色：/edit/[id]
// 服务端读 Character + Worldbook，传给 CharacterForm
// 页面下方附带 MemoryManager 组件，用于管理该角色的 RAG 长期记忆
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CharacterForm, type CharacterFormInitial } from "@/components/character-form";
import { MemoryManager } from "@/components/memory-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditCharacterPage({ params }: Props) {
  const { id } = await params;
  const c = await prisma.character.findUnique({
    where: { id },
    include: { worldbookEntries: { orderBy: { createdAt: "asc" } } },
  });
  if (!c) notFound();

  const initial: CharacterFormInitial = {
    id: c.id,
    name: c.name,
    avatar: c.avatar,
    description: c.description,
    personality: c.personality,
    firstMessage: c.firstMessage,
    systemPrompt: c.systemPrompt,
    isNsfw: c.isNsfw,
    worldbook: c.worldbookEntries.map((w) => ({
      id: w.id,
      keyword: w.keyword,
      content: w.content,
    })),
  };

  return (
    <div className="space-y-4">
      <CharacterForm initialData={initial} />
      <MemoryManager characterId={c.id} />
    </div>
  );
}
