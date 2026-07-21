// Surfaces the silent mock-data fallback.
//
// Every Supabase service falls back to mockDb when a query errors OR returns
// zero rows. That's useful for demos, but it silently masks real problems —
// most commonly RLS returning 0 rows (with no error) because the client has no
// authenticated session. This makes the app *look* like it's showing your data
// when it's actually showing demo data.
//
// Called from the fallback branch of each read, dev builds only.
export function warnMockFallback(
  source: string,
  error?: { message?: string } | null
): void {
  if (!import.meta.env.DEV) return;

  if (error?.message) {
    console.warn(`[TruckDesk] ${source}: falling back to MOCK data — Supabase error: ${error.message}`);
  } else {
    console.warn(
      `[TruckDesk] ${source}: falling back to MOCK data — query returned 0 rows. ` +
        `If you expect real data, this is usually Row Level Security blocking an ` +
        `unauthenticated session (e.g. the ?devbypass= shortcut does not create a ` +
        `real Supabase login). Sign in properly to read live rows.`
    );
  }
}
