-- Run once in the Supabase SQL editor. The app calls it with supabase.rpc('delete_my_account').
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  -- Keep other people's records, but unlink them from rows this account is about to lose.
  update public.whatsapp_submissions set linked_expense_id = null
    where driver_id <> uid
      and linked_expense_id in (select id from public.expenses where driver_id = uid);
  update public.whatsapp_submissions set linked_load_id = null
    where driver_id <> uid
      and linked_load_id in (select id from public.loads where driver_id = uid);
  update public.expenses set load_id = null
    where driver_id <> uid
      and load_id in (select id from public.loads where driver_id = uid);
  update public.invoices set load_id = null
    where driver_id <> uid
      and load_id in (select id from public.loads where driver_id = uid);
  update public.rate_history set load_id = null
    where driver_id <> uid
      and load_id in (select id from public.loads where driver_id = uid);
  update public.loads set truck_id = null
    where driver_id <> uid
      and truck_id in (select id from public.trucks where owner_id = uid);
  update public.documents set truck_id = null
    where driver_id <> uid
      and truck_id in (select id from public.trucks where owner_id = uid);
  update public.trucks set driver_id = null
    where driver_id = uid and owner_id <> uid;
  update public.users set owner_id = null where owner_id = uid;
  update public.users set referred_by = null where referred_by = uid;

  delete from public.whatsapp_submissions where driver_id = uid;
  delete from public.rate_history where driver_id = uid;
  delete from public.invoices where driver_id = uid;
  delete from public.expenses where driver_id = uid;
  delete from public.documents where driver_id = uid;
  delete from public.maintenance_schedule
    where driver_id = uid
       or truck_id in (select id from public.trucks where owner_id = uid);
  delete from public.compliance where driver_id = uid;
  delete from public.daily_mileage where driver_id = uid;
  delete from public.retirement_log where driver_id = uid;
  delete from public.tax_estimates where driver_id = uid;
  delete from public.loads where driver_id = uid;
  delete from public.trucks where owner_id = uid;
  delete from public.referrals where referrer_id = uid or referred_id = uid;
  delete from public.users where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
