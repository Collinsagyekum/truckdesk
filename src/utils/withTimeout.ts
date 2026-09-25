// Guarantees a promise settles.
//
// A Supabase call that never resolves (stalled fetch, token refresh wedge, a
// dropped connection) will hang an `await`/`Promise.all` forever, leaving the
// page stuck on a loading spinner with nothing in the console — because a
// request that never returns also never logs an error. Racing against a
// timeout means the UI always recovers and we get a diagnostic instead.
//
// A timeout rejects rather than resolving with a fallback value: an empty list
// after a stall reads as "you have no drivers" instead of "this didn't load".
export function withTimeout<T>(promise: Promise<T>, label: string, ms = 10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
