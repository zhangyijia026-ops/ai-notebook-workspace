# AI Notebook App

本地优先的 AI 笔记本 MVP，用于管理笔记、Todo、灵感摘录，并生成日报/周报。

## Development

```bash
npm run dev
```

## AI Mode

默认使用 mock AI，不需要 API Key。

如需启用真实 AI：

1. 复制 `.env.example` 为 `.env`。
2. 修改 `.env`：

```bash
VITE_AI_MODE=real
VITE_AI_PROXY_URL=http://127.0.0.1:8787
AI_API_KEY=sk-your-api-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4.1-mini
AI_PROXY_PORT=8787
```

如果使用 One API，把 `AI_BASE_URL` 改成你的 One API 地址，例如：

```bash
AI_BASE_URL=https://你的-one-api-域名/v1
AI_MODEL=gemini-3.5-flash
```

3. 启动本地 AI 代理：

```bash
npm run dev:ai
```

4. 另开一个终端启动前端：

```bash
npm run dev
```

前端不会直接读取 `OPENAI_API_KEY`。API Key 只由本地代理服务使用。

## Supabase Cloud Sync

云同步需要在 `.env` 中配置：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

建表 SQL 见工作区根目录：

```text
../SUPABASE_SETUP.md
```

当前同步方式是手动同步：

- 登录或注册 Supabase 用户。
- 点击“上传本地到云端”。
- 在另一台设备登录后点击“从云端恢复到本地”。
