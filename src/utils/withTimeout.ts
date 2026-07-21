// Guarantees a promise settles.
//
// A Supabase call that never resolves (stalled fetch, token refresh wedge, a
// dropped connection) will hang an `await`/`Promise.all` forever, leaving the
// page stuck on a loading spinner with nothing in the console — because a
// request that never returns also never logs an error. Racing against a
// timeout means the UI always recovers and we get a diagnostic instead.
export function withTimeout<T>(promise: Promise<T>, fallback: T, label: string, ms = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => {
        if (import.meta.env.DEV) {
          console.warn(`[TruckDesk] ${label}: timed out after ${ms}ms — using fallback so the page can render.`);
        }
        resolve(fallback);
      }, ms)
    ),
  ]);
}
