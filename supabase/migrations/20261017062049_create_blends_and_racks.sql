create table public.saved_blends (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  slugs text[] not null check (cardinality(slugs) between 1 and 73),
  created_at timestamptz not null default now()
);
create index saved_blends_user_id_created_at_idx on public.saved_blends (user_id, created_at desc);
alter table public.saved_blends enable row level security;
create policy "Users can read their blends" on public.saved_blends for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their blends" on public.saved_blends for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their blends" on public.saved_blends for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their blends" on public.saved_blends for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.saved_blends from anon;
grant select, insert, update, delete on public.saved_blends to authenticated;

create table public.spice_racks (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  slugs text[] not null default '{}' check (cardinality(slugs) <= 73)
);
alter table public.spice_racks enable row level security;
create policy "Users can read their rack" on public.spice_racks for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their rack" on public.spice_racks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their rack" on public.spice_racks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their rack" on public.spice_racks for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.spice_racks from anon;
grant select, insert, update, delete on public.spice_racks to authenticated;
