create table public.recipes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 200),
 ingredients text not null default '' check (char_length(ingredients) <= 20000),
 instructions text not null default '' check (char_length(instructions) <= 50000),
 slugs text[] not null default '{}' check (cardinality(slugs) <= 73),
 created_at timestamptz not null default now()
);
create index recipes_user_created_idx on public.recipes(user_id, created_at desc);
alter table public.recipes enable row level security;
create policy "Own recipes" on public.recipes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.recipes from anon;
grant select, insert, update, delete on public.recipes to authenticated;
