// 聊天索引页：/chat/[characterId]
// 行为：
//  1. 找该角色最新的 chat
//  2. 如果没有，则创建一个空 chat
//  3. 重定向到 /chat/[characterId]/[chatId]
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ characterId: string }> };

export default async function ChatIndexPage({ params }: Props) {
  const { characterId } = await params;
  const character = await prisma.character.findUnique({
    where: { id: characterId },
  });
  if (!character) notFound();

  // 找最新 chat
  let latest = await prisma.chat.findFirst({
    where: { characterId },
    orderBy: { createdAt: "desc" },
  });

  // 没有就新建
  if (!latest) {
    latest = await prisma.chat.create({
      data: { characterId, messages: "[]" },
    });
  }

  redirect(`/chat/${characterId}/${latest.id}`);
}
