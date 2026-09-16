/** Local routing hint only. Never use this value to authorize a server operation. */
export function localAccountIdFromSession(raw: string | null): string | null {
  if (raw === null) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('Saved account identity is unreadable; local saves are preserved'); }
  const id = (value as { user?: { id?: unknown } } | null)?.user?.id;
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Saved account identity is invalid; local saves are preserved');
  }
  // An expired access token must not stop a local save from loading.
  return id;
}

export function openLocalProfile<T>(readSession: () => string | null, open: (accountId: string) => T): T {
  const accountId = localAccountIdFromSession(readSession());
  if (!accountId) throw new Error('No local account is selected. Set up the pilot online once.');
  return open(accountId);
}
