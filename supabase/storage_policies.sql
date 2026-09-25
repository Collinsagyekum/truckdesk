-- Run once in the Supabase SQL editor. Lets signed-in users manage files in their own <bucket>/<user id>/ folder.
insert into storage.buckets (id, name, public)
values ('compliance-docs', 'compliance-docs', false)
on conflict (id) do nothing;

drop policy if exists "TruckDesk users read own files" on storage.objects;
create policy "TruckDesk users read own files" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('receipts', 'compliance-docs')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "TruckDesk users upload own files" on storage.objects;
create policy "TruckDesk users upload own files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('receipts', 'compliance-docs')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "TruckDesk users delete own files" on storage.objects;
create policy "TruckDesk users delete own files" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('receipts', 'compliance-docs')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
