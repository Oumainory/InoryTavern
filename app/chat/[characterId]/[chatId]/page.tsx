// 聊天主页面：/chat/[characterId]/[chatId]
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChatWorkspace } from "@/components/chat-workspace";
import type { CharacterDTO, ChatMessage, ChatSummaryDTO, WorldbookEntryDTO } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ characterId: string; chatId: string }> };

function summarize(chat: { id: string; characterId: string; createdAt: Date; messages: string }): ChatSummaryDTO {
  let msgs: ChatMessage[] = [];
  try {
    msgs = JSON.parse(chat.messages);
  } catch {
    msgs = [];
  }
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

export default async function ChatPage({ params }: Props) {
  const { characterId, chatId } = await params;

  // 一次性查所有数据
  const [character, currentChat, allChats] = await Promise.all([
    prisma.character.findUnique({
      where: { id: characterId },
      include: { worldbookEntries: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.chat.findUnique({ where: { id: chatId } }),
    prisma.chat.findMany({
      where: { characterId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!character) notFound();
  if (!currentChat || currentChat.characterId !== characterId) notFound();

  // 组装 character DTO
  const characterDTO: CharacterDTO = {
    id: character.id,
    name: character.name,
    avatar: character.avatar,
    description: character.description,
    personality: character.personality,
    firstMessage: character.firstMessage,
    systemPrompt: character.systemPrompt,
    isNsfw: character.isNsfw,
    createdAt: character.createdAt.toISOString(),
    worldbook: character.worldbookEntries.map(
      (w): WorldbookEntryDTO => ({
        id: w.id,
        keyword: w.keyword,
        content: w.content,
      })
    ),
  };

  // 解析当前 chat 的 messages
  let initialMessages: ChatMessage[] = [];
  try {
    initialMessages = JSON.parse(currentChat.messages);
  } catch {
    initialMessages = [];
  }

  const initialChats: ChatSummaryDTO[] = allChats.map(summarize);

  return (
    <div className="container mx-auto px-0 md:px-4 py-0 md:py-6 h-[calc(100vh-3.5rem)]">
      <ChatWorkspace
        character={characterDTO}
        currentChatId={currentChat.id}
        initialMessages={initialMessages}
        initialChats={initialChats}
      />
    </div>
  );
}
