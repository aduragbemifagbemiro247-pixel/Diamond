export async function apiFetch<T>(
  url: string,
  options: RequestInit & { token?: string | null; adminToken?: string | null } = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  if (options.adminToken) {
    headers.set('X-Admin-Token', options.adminToken);
  }

  const resp = await fetch(url, {
    ...options,
    headers,
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || data.message || `Request failed (${resp.status})`);
  }
  return data as T;
}

export function formatNaira(amount: number, symbol = '₦'): string {
  return `${symbol}${Math.round(amount).toLocaleString('en-NG')}`;
}
