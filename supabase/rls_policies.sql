-- TruckDesk — fleet (multi-tenant) read isolation
-- Run once in the Supabase SQL editor.
--
-- GOAL: an owner sees ONLY their own drivers' data; a driver sees only their
-- own. Drivers are linked to an owner by users.owner_id === that owner's id.
-- MilesBot writes with the service role, which bypasses RLS, so nothing here
-- affects WhatsApp logging.
--
-- WHAT THIS CHANGES (reads only — no driver write policy is touched):
--   * Drops the is_owner() blanket-read policies (td_read_* and
--     "Owner reads all daily_mileage") that let ANY owner read EVERY row.
--   * Adds owner_see_fleet_* read policies (owner reads a row only when its
--     driver has owner_id = auth.uid()) on the tables missing one. loads and
--     expenses already had a correct one; recreated here so all six match.
--   * Also drops td_update_users, which let any owner UPDATE any user row.
--     Own-row read/insert/update and driver-own policies are left in place,
--     so every existing driver and self-profile operation keeps working.
--
-- Safe to re-run: every create is preceded by drop ... if exists.

begin;

-- ── daily_mileage ────────────────────────────────────────────────────────────
-- Both existing INSERT policies are open holes: "Insert daily_mileage" is
-- {public} CHECK true (even anon can insert) and "Service role can insert
-- mileage" is actually scoped to {authenticated} CHECK true (any signed-in user
-- can insert a row for ANY driver). The app never inserts mileage — only
-- MilesBot does, with the service role, which bypasses RLS — so replace both
-- with a driver-owns-own-row insert.
drop policy if exists "Insert daily_mileage" on public.daily_mileage;
drop policy if exists "Service role can insert mileage" on public.daily_mileage;
drop policy if exists "driver_insert_own_mileage" on public.daily_mileage;
create policy "driver_insert_own_mileage" on public.daily_mileage
  for insert to authenticated
  with check (driver_id = auth.uid());

drop policy if exists "Owner reads all daily_mileage" on public.daily_mileage;
drop policy if exists "owner_see_fleet_daily_mileage" on public.daily_mileage;
create policy "owner_see_fleet_daily_mileage" on public.daily_mileage
  for select to authenticated
  using (exists (
    select 1 from public.users
    where users.id = daily_mileage.driver_id
      and users.owner_id = auth.uid()
  ));

-- ── expenses ─────────────────────────────────────────────────────────────────
drop policy if exists "td_read_expenses" on public.expenses;
drop policy if exists "owner_see_fleet_expenses" on public.expenses;
create policy "owner_see_fleet_expenses" on public.expenses
  for select to authenticated
  using (exists (
    select 1 from public.users
    where users.id = expenses.driver_id
      and users.owner_id = auth.uid()
  ));

-- ── invoices ─────────────────────────────────────────────────────────────────
-- invoices had ONLY the broad td_read_invoices policy, so re-add an explicit
-- driver-own read next to the owner-fleet read.
drop policy if exists "td_read_invoices" on public.invoices;
drop policy if exists "driver_read_invoices" on public.invoices;
create policy "driver_read_invoices" on public.invoices
  for select to authenticated
  using (driver_id = auth.uid());
drop policy if exists "owner_see_fleet_invoices" on public.invoices;
create policy "owner_see_fleet_invoices" on public.invoices
  for select to authenticated
  using (exists (
    select 1 from public.users
    where users.id = invoices.driver_id
      and users.owner_id = auth.uid()
  ));

-- ── loads ────────────────────────────────────────────────────────────────────
drop policy if exists "td_read_loads" on public.loads;
drop policy if exists "owner_see_fleet_loads" on public.loads;
create policy "owner_see_fleet_loads" on public.loads
  for select to authenticated
  using (exists (
    select 1 from public.users
    where users.id = loads.driver_id
      and users.owner_id = auth.uid()
  ));

-- ── retirement_log ───────────────────────────────────────────────────────────
drop policy if exists "td_read_retirement" on public.retirement_log;
drop policy if exists "owner_see_fleet_retirement" on public.retirement_log;
create policy "owner_see_fleet_retirement" on public.retirement_log
  for select to authenticated
  using (exists (
    select 1 from public.users
    where users.id = retirement_log.driver_id
      and users.owner_id = auth.uid()
  ));

-- ── users ────────────────────────────────────────────────────────────────────
-- Keep the existing own-row policies (auth.uid() = id). Remove the is_owner()
-- blanket read + update, and let an owner read ONLY their own drivers' rows
-- (users.owner_id = this owner's id). An owner reads their OWN row through the
-- surviving "Users can read own row" policy.
drop policy if exists "td_read_users" on public.users;
drop policy if exists "td_update_users" on public.users;
drop policy if exists "owner_see_fleet_users" on public.users;
create policy "owner_see_fleet_users" on public.users
  for select to authenticated
  using (owner_id = auth.uid());

commit;
