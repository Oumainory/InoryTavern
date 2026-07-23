// 首页：角色列表瀑布流
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CharacterCard } from "@/components/character-card";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Plus } from "lucide-react";
import type { CharacterDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const list = await prisma.character.findMany({
    orderBy: { createdAt: "desc" },
  });
  const characters: CharacterDTO[] = list.map((c) => ({
    id: c.id,
    name: c.name,
    avatar: c.avatar,
    description: c.description,
    personality: c.personality,
    firstMessage: c.firstMessage,
    systemPrompt: c.systemPrompt,
    isNsfw: c.isNsfw,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-heading font-semibold tracking-tight">
            遇见你的角色
          </h1>
          <p className="text-muted-foreground mt-1">
            浏览所有可聊天的 AI 角色，或创造一个属于你的。
          </p>
        </div>
        <LinkButton href="/create">
          <Plus className="size-4" />
          创建角色
        </LinkButton>
      </div>

      {characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-4">🍻</div>
          <h2 className="text-xl font-heading font-medium mb-2">InoryTavern 里还没有角色</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            从零开始创建你的第一个 AI 角色，赋予它性格与故事。
          </p>
          <LinkButton href="/create">
            <Plus className="size-4" />
            创建第一个角色
          </LinkButton>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
          {characters.map((c) => (
            <CharacterCard key={c.id} character={c} />
          ))}
        </div>
      )}
    </div>
  );
}
