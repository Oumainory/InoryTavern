// PNG 解析/生成工具：用于 Tavern 角色卡的导入导出
// 纯 JS 实现，浏览器端运行，不依赖 Node Buffer / Webpack polyfill
//
// Tavern 卡规范：
//   - 把角色 JSON 字符串 base64 编码后，作为 PNG 的 tEXt chunk 写入
//   - chunk 的 keyword 为 "chara"
//   - 规范参考：https://github.com/malfoyslastname/character-card-spec-v2

// PNG 文件签名
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// CRC32 查找表（PNG 用 IEEE 多项式 0xedb88320）
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Base64 dataURL <-> Uint8Array
function base64ToBytes(input: string): Uint8Array {
  const idx = input.indexOf(",");
  const raw = idx >= 0 ? input.slice(idx + 1) : input;
  // 去掉可能存在的空白
  const cleaned = raw.replace(/\s+/g, "");
  const binary = atob(cleaned);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  // 分块处理避免 call stack overflow
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK))
    );
  }
  return btoa(s);
}

function readUint32BE(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) |
      (buf[offset + 1] << 16) |
      (buf[offset + 2] << 8) |
      buf[offset + 3]) >>>
    0
  );
}

function writeUint32BE(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

type ParsedChunk = {
  type: string;
  data: Uint8Array;
};

function readChunks(buf: Uint8Array): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];
  let pos = 8; // 跳过 8 字节签名
  while (pos + 8 <= buf.length) {
    const length = readUint32BE(buf, pos);
    const type = String.fromCharCode(
      buf[pos + 4],
      buf[pos + 5],
      buf[pos + 6],
      buf[pos + 7]
    );
    const dataStart = pos + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buf.length) break; // 数据被截断，停止
    // 不强校验 CRC（PNG 规范的容错），但我们读取数据时跳过 CRC 字段
    chunks.push({ type, data: buf.slice(dataStart, dataEnd) });
    pos = dataEnd + 4;
    if (type === "IEND") break;
  }
  return chunks;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) typeBytes[i] = type.charCodeAt(i);
  const lengthBytes = writeUint32BE(data.length);
  // CRC 覆盖 type + data
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  const crcBytes = writeUint32BE(crc32(crcInput));
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  chunk.set(lengthBytes, 0);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  chunk.set(crcBytes, 8 + data.length);
  return chunk;
}

function makeTextChunk(keyword: string, text: string): Uint8Array {
  const enc = new TextEncoder();
  const kw = enc.encode(keyword);
  const txt = enc.encode(text);
  // tEXt: keyword + 0x00 + text
  const data = new Uint8Array(kw.length + 1 + txt.length);
  data.set(kw, 0);
  data.set(txt, kw.length + 1);
  // 中间 0x00 分隔符已默认为 0
  return makeChunk("tEXt", data);
}

function isPng(buf: Uint8Array): boolean {
  if (buf.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

// 读取 tEXt chunk 中 keyword 匹配的文本内容（base64 文本 → 字符串）
function readTextFromChunk(chunk: ParsedChunk): { keyword: string; text: string } | null {
  const nullIdx = chunk.data.indexOf(0);
  if (nullIdx < 0) return null;
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const keyword = decoder.decode(chunk.data.slice(0, nullIdx));
  const text = decoder.decode(chunk.data.slice(nullIdx + 1));
  return { keyword, text };
}

// === 公开 API ===

export type TavernCharacterCard = {
  // 兼容 V1（平铺）和 V2/V3（嵌套在 data 下）
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creatorcomment?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  tags?: string[];
  character_book?: {
    name?: string;
    entries?: Array<{
      keys?: string[] | string;
      key?: string[];
      keywords?: string[] | string;
      content?: string;
      comment?: string;
      enabled?: boolean;
      insertion_order?: number;
      case_sensitive?: boolean;
      constant?: boolean;
      selective?: boolean;
      secondary_keys?: string[];
      // V3 扩展字段（暂不解析）
    }>;
  };
  data?: TavernCharacterCard;
  spec?: string;
  spec_version?: string;
};

/**
 * 读取一个 Tavern 角色卡 PNG 文件，返回解析后的 JSON 对象（V1/V2/V3 通用）
 */
export async function readTavernPng(file: File): Promise<TavernCharacterCard> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (!isPng(buf)) {
    throw new Error("不是有效的 PNG 文件");
  }
  const chunks = readChunks(buf);
  for (const chunk of chunks) {
    if (chunk.type !== "tEXt") continue;
    const t = readTextFromChunk(chunk);
    if (!t) continue;
    if (t.keyword.toLowerCase() !== "chara") continue;
    // 文本是 base64 编码的 JSON
    const jsonStr = atob(t.text.replace(/\s+/g, ""));
    try {
      return JSON.parse(jsonStr) as TavernCharacterCard;
    } catch (err) {
      throw new Error("chara chunk 内的 JSON 解析失败：" + (err as Error).message);
    }
  }
  throw new Error("未在 PNG 中找到 Tavern 角色卡数据（缺少 keyword=chara 的 tEXt chunk）");
}

/**
 * 把角色 JSON 写入原始 PNG 的 chara tEXt chunk，返回新的 data URL
 * - 如果传入的图片不是 PNG（如 JPEG），会用 canvas 转成 PNG
 * - 旧的 chara tEXt chunk 会被替换
 */
export async function writeTavernPng(
  originalImageBase64: string,
  characterData: TavernCharacterCard | Record<string, unknown>
): Promise<string> {
  let base64 = originalImageBase64;
  // 必须是 PNG，否则转 PNG
  if (!/^data:image\/png/i.test(base64)) {
    base64 = await convertImageToPngDataUrl(base64);
  }
  const bytes = base64ToBytes(base64);
  if (!isPng(bytes)) {
    throw new Error("原始图像不是有效的 PNG");
  }
  const chunks = readChunks(bytes);

  // 过滤掉已存在的 chara tEXt
  const filtered: ParsedChunk[] = [];
  for (const c of chunks) {
    if (c.type === "tEXt") {
      const t = readTextFromChunk(c);
      if (t && t.keyword.toLowerCase() === "chara") continue;
    }
    filtered.push(c);
  }

  // 构造 chara tEXt chunk：JSON → 字符串 → UTF-8 → base64
  const jsonStr = JSON.stringify(characterData);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const b64 = bytesToBase64(jsonBytes);
  const charaChunk = makeTextChunk("chara", b64);

  // 找 IHDR 位置：chara tEXt 必须插在 IHDR 之后、IDAT 之前
  const ihdrIdx = filtered.findIndex((c) => c.type === "IHDR");
  if (ihdrIdx < 0) {
    throw new Error("PNG 缺少 IHDR chunk");
  }

  // 重新拼接 PNG
  const parts: Uint8Array[] = [PNG_SIGNATURE];
  let total = 8;
  for (let i = 0; i <= ihdrIdx; i++) {
    const c = filtered[i];
    const chunkBytes = makeChunk(c.type, c.data);
    parts.push(chunkBytes);
    total += chunkBytes.length;
  }
  parts.push(charaChunk);
  total += charaChunk.length;
  for (let i = ihdrIdx + 1; i < filtered.length; i++) {
    const c = filtered[i];
    const chunkBytes = makeChunk(c.type, c.data);
    parts.push(chunkBytes);
    total += chunkBytes.length;
  }

  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return "data:image/png;base64," + bytesToBase64(out);
}

// 把任意 dataURL 图片（JPEG/PNG/WebP）转成 PNG dataURL
async function convertImageToPngDataUrl(dataUrl: string): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("图片格式转换需要浏览器环境");
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("图片加载失败"));
    i.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 canvas context");
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * 从 Tavern 卡片中提取适用于本系统的扁平化数据
 * 兼容 V1 / V2 / V3
 */
export function normalizeTavernCard(card: TavernCharacterCard): {
  name: string;
  description: string;
  personality: string;
  firstMessage: string;
  systemPrompt: string;
  worldbook: { keyword: string; content: string }[];
} {
  // V2/V3：字段在 data 下；V1：直接平铺
  const data = (card.data || card) as TavernCharacterCard;
  const raw = data.character_book;
  const entries = Array.isArray(raw?.entries) ? raw!.entries! : [];
  const worldbook = entries
    .map((e) => {
      // 兼容多种 key 命名：keys / key / keywords
      let kw: string[] = [];
      if (Array.isArray(e.keys)) kw = e.keys;
      else if (Array.isArray(e.key)) kw = e.key;
      else if (Array.isArray(e.keywords)) kw = e.keywords;
      else if (typeof e.keys === "string") kw = e.keys.split(",").map((s: string) => s.trim());
      const content = (e.content || "").toString();
      if (e.enabled === false) return null; // 跳过被禁用的条目
      return { keyword: kw.join(","), content };
    })
    .filter((w): w is { keyword: string; content: string } =>
      !!w && (w.keyword.trim() !== "" || w.content.trim() !== "")
    );
  return {
    name: (data.name || "").toString(),
    description: (data.description || "").toString(),
    personality: (data.personality || "").toString(),
    firstMessage: (data.first_mes || "").toString(),
    systemPrompt: (data.system_prompt || "").toString(),
    worldbook,
  };
}

/**
 * 把本系统的扁平化数据打包成 V2 规范的 Tavern JSON
 */
export function buildTavernV2Card(input: {
  name: string;
  description: string;
  personality?: string | null;
  firstMessage?: string | null;
  systemPrompt?: string | null;
  worldbook?: { keyword: string; content: string }[];
  creatorNotes?: string;
  tags?: string[];
}): Record<string, unknown> {
  const entries = (input.worldbook || [])
    .filter((e) => e.keyword.trim() || e.content.trim())
    .map((e, i) => ({
      keys: e.keyword
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      content: e.content,
      enabled: true,
      insertion_order: i,
    }));
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: input.name,
      description: input.description,
      personality: input.personality || "",
      scenario: "",
      first_mes: input.firstMessage || "",
      mes_example: "",
      creatorcomment: input.creatorNotes || "",
      avatar: "none",
      chat: "",
      talkativeness: "0.5",
      fav: false,
      tags: input.tags || [],
      spec: "chara_card_v2",
      spec_version: "2.0",
      system_prompt: input.systemPrompt || "",
      post_history_instructions: "",
      alternate_greetings: [],
      character_book: {
        name: "",
        entries,
      },
    },
  };
}
