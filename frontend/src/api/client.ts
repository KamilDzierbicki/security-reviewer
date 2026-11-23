const TOKEN_KEY = 'token';
const EMAIL_KEY = 'email';

export class UnauthorizedError extends Error {}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getEmail(): string {
  return sessionStorage.getItem(EMAIL_KEY) ?? '';
}

export function setSession(
  session: { token: string; email: string } | null,
): void {
  if (session) {
    sessionStorage.setItem(TOKEN_KEY, session.token);
    sessionStorage.setItem(EMAIL_KEY, session.email);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
  }
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  });
  if (response.status === 401 && getToken()) {
    throw new UnauthorizedError('Session expired, sign in again');
  }
  const body: unknown =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { message?: string | string[] } | null)?.message;
    throw new Error(
      Array.isArray(message) ? message.join(', ') : message || 'Request failed',
    );
  }
  return body as T;
}
