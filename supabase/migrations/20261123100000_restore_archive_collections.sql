-- Personal Dragon Blanc backups, separate from the shared Sports collection.
create table public.rapli_archive_collections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  archive_state jsonb not null,
  payload jsonb not null default '{}'::jsonb,
  state_revision bigint not null default 1 check (state_revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.rapli_archive_collections enable row level security;
revoke all on public.rapli_archive_collections from public, anon, authenticated;
grant select, insert, update on public.rapli_archive_collections to authenticated;

create policy "Personal archive owner and paired devices"
on public.rapli_archive_collections for all to authenticated
using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.rapli_archive_members m
    where m.member_id = (select auth.uid()) and m.owner_id = rapli_archive_collections.user_id
  )
)
with check (
  user_id = (select auth.uid()) or exists (
    select 1 from public.rapli_archive_members m
    where m.member_id = (select auth.uid()) and m.owner_id = rapli_archive_collections.user_id
  )
);
