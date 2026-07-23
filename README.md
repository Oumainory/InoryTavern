# InoryTavern · 祈之音酒馆

> 一个轻量、高性能的本地 AI 角色扮演 WebUI。
> 让每一个故事都拥有自己的声音与记忆。

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149eca)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2d3748)](https://www.prisma.io)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

---

## ✨ 核心特性

- 🚀 **开箱即用**：纯 Node.js 架构，**零 C++ / 原生依赖**。在 Windows、Linux、macOS 上 `npm install && npm run dev` 即可秒级启动，再也不会被 `node-gyp` 折腾。
- 🧠 **内置 RAG 长期记忆**：无需配置 `pgvector` / `chromadb` 等向量库。系统会在每轮对话后自动抽取记忆入库，下一轮用纯 JS 余弦相似度检索，让 AI 自然地记住你的名字、喜好、剧情走向。
- 🎙️ **多模型路由 + 角色专属 TTS**：聊天 / 智能捏卡 / 语音朗读 三个场景可独立指定模型；完美集成 Kokoro TTS，支持 8 种语言自动切换（中/英/日/法/西/意/葡/印地）。
- ✨ **AI 智能捏卡**：一句话描述，AI 自动生成完整角色设定（人设、世界书、开场白）并填充表单。
- 📥 **Tavern 角色卡互导**：支持标准 PNG `tEXt(chara)` 规范的导入与导出，可与 SillyTavern / Tavern 等生态互通。
- 🌗 **现代 WebUI**：Next.js 16 + React 19 + Tailwind 4 + Shadcn base-nova 风格，深色模式原生支持。

---

## 📸 快速预览

| 首页 | 聊天 | 设置 |
| :---: | :---: | :---: |
| 瀑布流角色卡 | Monica 风格分支切换 + 朗读 | 多模型独立配置 + Kokoro 试听 |

---

## 🚀 快速开始

### 环境要求

- **Node.js ≥ 18.18**（推荐 20 LTS 或 22 LTS）
- **npm ≥ 9**（或 pnpm / yarn，自行替换命令）
- 任意兼容 OpenAI 格式的 API 服务（OpenAI、Azure、OneAPI、totalgpt、自建中转均可）

### 一键启动

```bash
# 1. 克隆项目
git clone https://github.com/<your-name>/inorytavern.git
cd inorytavern

# 2. 安装依赖
npm install

# 3. 创建 .env（注意：真实密钥绝对不要提交到 Git！）
cp .env.example .env
# 然后用编辑器打开 .env，填入你的 OPENAI_API_KEY 和 OPENAI_BASE_URL

# 4. 初始化数据库（首次运行必须）
npx prisma db push

# 5. 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可看到酒馆首页 🎉

### 生产部署

```bash
npm run build
npm start
```

---

## ⚙️ 配置说明

所有配置项都可以在网页 **「设置」** 页动态修改并保存到数据库，无需重启。

| 配置项 | 说明 | 必填 |
| :--- | :--- | :---: |
| `OPENAI_API_KEY` | API 密钥 | ✅ |
| `OPENAI_BASE_URL` | 兼容 OpenAI 格式的服务地址 | ✅ |
| `OPENAI_MODEL` | 默认聊天/捏卡模型兜底值 | ❌ |
| `OPENAI_TTS_MODEL` | 语音模型兜底值 | ❌ |
| `OPENAI_EMBEDDING_MODEL` | RAG 向量化模型 | ❌ |

> **小贴士**：进入「设置」页后可以分别独立指定 *聊天模型*、*捏卡模型*、*语音模型*，并可以试听 Kokoro 8 种语言 × 多种音色的组合。

---

## 🛠️ 技术栈

| 层级 | 选型 |
| :--- | :--- |
| 框架 | Next.js 16.2 (App Router) + React 19 |
| 语言 | TypeScript 5 |
| 样式 | Tailwind CSS 4 + Shadcn base-nova（@base-ui/react） |
| 数据库 | SQLite + Prisma 6 |
| 状态 | Zustand 5 |
| AI SDK | OpenAI 官方 SDK 6.x（兼容任何 /v1/chat/completions 中转） |
| RAG | 纯 JS 余弦相似度 + JSON 序列化向量 |
| TTS | OpenAI 兼容 audio.speech（Kokoro / tts-1 / 一句话服务） |
| Markdown | react-markdown + remark-gfm |

---

## 📁 目录结构

```
inorytavern/
├── app/
│   ├── api/                  # 后端路由
│   │   ├── chat/             # 流式对话 + RAG 记忆注入
│   │   ├── characters/       # 角色 CRUD
│   │   ├── chats/            # 多对话历史
│   │   ├── generate-character/# AI 智能捏卡
│   │   ├── memories/         # 长期记忆管理
│   │   ├── models/           # 拉取上游模型列表
│   │   ├── settings/         # 全局配置
│   │   └── tts/              # 语音合成（含 Kokoro 多语种）
│   ├── create/               # 创建角色页
│   ├── edit/[id]/            # 编辑角色页
│   ├── chat/[characterId]/[chatId]/  # 聊天页
│   ├── settings/             # 设置页
│   ├── layout.tsx            # 根布局（顶部导航）
│   └── page.tsx              # 首页（角色瀑布流）
├── components/               # 客户端组件
│   ├── character-card.tsx    # 角色卡（含编辑/导出/删除）
│   ├── character-form.tsx    # 创角/编辑表单（含 AI 捏卡、PNG 导入）
│   ├── chat-view.tsx         # Monica 风格聊天视图
│   ├── chat-workspace.tsx    # 左侧历史 + 右侧聊天布局
│   ├── memory-manager.tsx    # RAG 长期记忆管理 UI
│   └── theme-toggle.tsx      # 主题切换
├── lib/
│   ├── prisma.ts             # Prisma 单例
│   ├── store.ts              # Zustand 状态
│   ├── types.ts              # 共享类型
│   ├── utils.ts              # cn() 工具
│   ├── vector.ts             # ⭐ 纯 JS 向量检索
│   └── png-utils.ts          # Tavern PNG 角色卡编解码
├── prisma/
│   └── schema.prisma         # Character / Chat / Memory / WorldbookEntry / Setting
├── .env.example              # 环境变量模板
├── .gitignore                # Git 忽略规则
└── README.md                 # 你正在看的文件
```

---

## 🔒 隐私与安全

- 🔐 **所有聊天记录只存在你自己的 SQLite 文件中**（`prisma/dev.db`），绝不上传任何服务器。
- 🔑 **API Key 全部本地保存**，网页设置页默认以 `sk-••••xxxx` 形式脱敏回显。
- 🚫 **`.gitignore` 已默认排除 `.env`、`*.db`、`node_modules`、`.next`**，直接 `git init` 即可安全提交。

---

## 🐛 常见问题

**Q：拉取模型列表显示「Unexpected end of JSON input」？**
A：通常是 `baseUrl` 不正确或上游服务在重启。进入「设置」核对 `API Base URL`，确保末尾无多余 `/`。

**Q：Kokoro 西语试听到法语声音（串台）？**
A：已在最新版本修复：短句试听时强制通过 `voice` ID 首字母推导 `lang` 参数，绕开文本检测。

**Q：embedding 调用太慢？**
A：可在 `.env` 把 `OPENAI_EMBEDDING_MODEL` 改成更小的模型（如 `text-embedding-3-small` → `text-embedding-3-large` 的反向升级通常无意义，前者已经足够）。

**Q：我想换个数据库（比如 Postgres）？**
A：修改 `prisma/schema.prisma` 的 `datasource db provider`，然后 `npx prisma db push` 即可。代码本身不依赖任何 SQLite 特性。

---

## 🤝 贡献

欢迎 PR！提交前请确保：

1. `npm run lint` 无 error
2. `npx tsc --noEmit` 通过
3. 涉及的 DB 变更附上 `npx prisma db push` 后的 schema 同步说明

---

## 📜 License

[MIT](https://opensource.org/licenses/MIT) — 自由使用、修改、分发，只需保留原作者声明。

---

<p align="center">
  Made with ❤️ by the InoryTavern community<br/>
  <sub>愿每个深夜，都有角色陪你说话。</sub>
</p>
