# Supabase Setup

## 1. Environment Variables

在 `app/.env` 中加入：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

`VITE_SUPABASE_ANON_KEY` 是 Supabase Project Settings -> API 里的 anon public key。

## 2. Auth

进入 Supabase Dashboard：

1. 打开 Authentication。
2. 确认 Email 登录已启用。
3. MVP 阶段可以先使用邮箱 + 密码。

## 3. Database Table

进入 SQL Editor，执行：

```sql
create table if not exists public.notebook_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.notebook_data enable row level security;

create policy "Users can read own notebook data"
on public.notebook_data
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own notebook data"
on public.notebook_data
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own notebook data"
on public.notebook_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## 4. Sync Model

当前 MVP 云同步是手动同步：

- `上传本地到云端`：把当前浏览器 localStorage 中的完整数据保存到 Supabase。
- `从云端恢复到本地`：把 Supabase 中的数据覆盖当前浏览器本地数据。

这样可以降低误同步风险。后续再做自动双向同步、冲突合并和多设备实时更新。
