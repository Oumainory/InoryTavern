// 通用类型定义

export type Role = "system" | "user" | "assistant";

/**
 * 单条聊天消息。
 * - content: 当前显示的内容（来自 swipes[activeSwipe] 或自身）
 * - swipes: 备选回复列表（AI 消息的多次重新生成结果；用户消息一般为 undefined）
 * - activeSwipe: 当前选中的 swipe 下标；未传时按 0 处理
 * - id: 稳定 ID，用于 React key / 跨重渲染标识
 */
export interface ChatMessage {
  id?: string;
  role: Role;
  content: string;
  swipes?: string[];
  activeSwipe?: number;
}

// 辅助：取某条消息实际显示的文本
export function getMessageContent(m: ChatMessage): string {
  if (Array.isArray(m.swipes) && m.swipes.length > 0) {
    const i = Math.max(0, Math.min(m.activeSwipe ?? 0, m.swipes.length - 1));
    return m.swipes[i] ?? "";
  }
  return m.content || "";
}

export interface WorldbookEntryDTO {
  id: string;
  keyword: string;
  content: string;
}

export interface CharacterDTO {
  id: string;
  name: string;
  avatar: string | null;
  description: string;
  personality: string | null;
  firstMessage: string | null;
  systemPrompt: string | null;
  isNsfw: boolean;
  createdAt: string;
  worldbook?: WorldbookEntryDTO[];
}

export interface SettingDTO {
  id: string;
  baseUrl: string;
  apiKey: string;
  apiKeyMasked: string;
  // 三个模型分别负责不同场景：聊天 / 智能捏卡 / 语音朗读
  chatModel: string;
  generateModel: string;
  ttsModel: string;
  // TTS 自定义 voice 列表（用逗号分隔），用于 Kokoro 等多 voice 模型按语言自动匹配
  ttsVoice: string;
}

export interface ChatSummaryDTO {
  id: string;
  characterId: string;
  createdAt: string;
  // 第一条 user 消息作为标题（截断）
  title: string;
  // 最后一条消息的角色和内容
  lastRole: "user" | "assistant" | "system" | null;
  lastContent: string;
  // 消息条数
  messageCount: number;
}
