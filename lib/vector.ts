// 向量工具库：RAG 长期记忆核心
// 纯 JS 实现，无任何 C++ / 平台编译依赖，跨平台稳定
//
// 职责：
//   1. cosineSimilarity  — 纯 JS 余弦相似度（点积 / 模长乘积）
//   2. getEmbedding       — 调用 OpenAI 兼容的 /v1/embeddings 接口（baseUrl/apiKey 来自 DB Setting）
//   3. saveMemory         — 接收文本 → 调 embedding → 存到 Memory 表（embedding 序列化为 JSON）
//   4. searchMemory       — 接收查询文本 → 调 embedding → 在该角色 Memory 上做纯 JS 相似度排序 → 返回 topK
//
// 设计原则：单机本地小数据量（单角色 ≤ 几万条），纯 JS 数组遍历点积性能绰绰有余。

import { prisma } from "@/lib/prisma";

/**
 * 余弦相似度（Cosine Similarity）
 * 取值范围 [-1, 1]，越接近 1 越相似。
 * 纯 JS 实现，无任何依赖。维度不同时返回 0。
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;
  if (vecA.length === 0 || vecA.length !== vecB.length) return 0;

  let dot = 0; // 点积
  let normA = 0; // |A|²
  let normB = 0; // |B|²
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 从 DB 读取 Embedding 配置（apiKey / baseURL / model）
 * 与 chat / generate-character / tts 完全同源，确保统一接入
 */
async function getEmbeddingConfig(): Promise<{
  apiKey: string;
  baseURL: string;
  model: string;
}> {
  const setting = await prisma.setting.findUnique({ where: { id: "global" } });
  const apiKey = setting?.apiKey || process.env.OPENAI_API_KEY || "";
  const baseURL =
    setting?.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  // Setting 表里的 embeddingModel，兜底 text-embedding-3-small
  const model =
    (setting as { embeddingModel?: string } | null)?.embeddingModel ||
    process.env.OPENAI_EMBEDDING_MODEL ||
    "text-embedding-3-small";
  return { apiKey, baseURL, model };
}

/**
 * 调用 Embedding API（OpenAI 兼容的 /v1/embeddings）
 * 返回向量数组
 */
export async function getEmbedding(text: string): Promise<number[]> {
  if (!text || !text.trim()) {
    throw new Error("Embedding 文本不能为空");
  }
  const { apiKey, baseURL, model } = await getEmbeddingConfig();
  if (!apiKey) {
    throw new Error("未配置 API Key：请在「设置」页填写，或在 .env 中设置 OPENAI_API_KEY");
  }

  // 标准化 baseURL：兼容用户填 "https://api.openai.com/v1/" 或 "https://api.openai.com/v1"
  const normalizedBase = baseURL.replace(/\/+$/, "");
  const url = `${normalizedBase}/embeddings`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Embedding 请求失败 (HTTP ${res.status})：${detail.slice(0, 200)}`
    );
  }

  const json = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const vec = json.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length === 0) {
    throw new Error("Embedding 响应格式异常：未返回向量数据");
  }
  return vec.map((n) => Number(n));
}

/**
 * 保存一条记忆：
 *   1. 调 getEmbedding 拿向量
 *   2. JSON.stringify 向量
 *   3. 写入 Memory 表
 */
export async function saveMemory(
  characterId: string,
  content: string,
  chatId?: string | null
): Promise<{ id: string }> {
  if (!characterId) throw new Error("characterId 必填");
  if (!content || !content.trim()) throw new Error("记忆内容不能为空");
  const vec = await getEmbedding(content);
  const embeddingStr = JSON.stringify(vec);
  const row = await prisma.memory.create({
    data: {
      characterId,
      chatId: chatId || null,
      content: content.trim(),
      embedding: embeddingStr,
    },
  });
  return { id: row.id };
}

/**
 * 在某个角色的所有记忆中做相似度检索，返回 topK 记忆文本。
 * 简单策略：拉全表 → 解析向量 → 算余弦 → 排序 → 取 top K。
 * 适合单角色数据量 < 5 万条；超出后建议按时间窗或主键分片再扫。
 */
export async function searchMemory(
  characterId: string,
  text: string,
  topK: number = 3
): Promise<Array<{ id: string; content: string; score: number; createdAt: Date }>> {
  if (!characterId) return [];
  if (!text || !text.trim()) return [];

  // 限长保护：避免无意义超长查询
  const queryText = text.slice(0, 2048);
  let queryVec: number[];
  try {
    queryVec = await getEmbedding(queryText);
  } catch (e) {
    // embedding 失败不阻塞聊天主流程
    console.error("[memory] embedding failed:", (e as Error).message);
    return [];
  }

  const rows = await prisma.memory.findMany({
    where: { characterId },
    orderBy: { createdAt: "desc" },
    // 安全帽：单角色最多扫 5000 条；超出后由后续分片/ANN 优化
    take: 5000,
  });

  if (rows.length === 0) return [];

  const scored: Array<{
    id: string;
    content: string;
    score: number;
    createdAt: Date;
  }> = [];

  for (const r of rows) {
    let vec: number[];
    try {
      vec = JSON.parse(r.embedding) as number[];
    } catch {
      continue; // 损坏的 embedding 跳过
    }
    const score = cosineSimilarity(queryVec, vec);
    if (Number.isFinite(score)) {
      scored.push({ id: r.id, content: r.content, score, createdAt: r.createdAt });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, topK));
}

/**
 * 删除某条记忆
 */
export async function deleteMemory(id: string): Promise<void> {
  await prisma.memory.delete({ where: { id } });
}

/**
 * 列出某角色的所有记忆（管理后台用，按时间倒序）
 */
export async function listMemories(characterId: string) {
  return prisma.memory.findMany({
    where: { characterId },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, chatId: true, createdAt: true },
  });
}
