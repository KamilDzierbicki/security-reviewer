import { useState, type FormEvent } from 'react';
import { api } from '../api/client.ts';

type Mode = 'login' | 'register';

export function AuthPanel({
  onSignedIn,
}: {
  onSignedIn: (token: string, email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const mode: Mode = submitter?.value === 'register' ? 'register' : 'login';
    setError('');
    setBusy(true);
    try {
      const body = await api<{ accessToken: string }>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onSignedIn(body.accessToken, email);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <h2>Sign in</h2>
      <form className="row" onSubmit={submit}>
        <input
          type="email"
          placeholder="you@example.com"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password (min. 10 characters)"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="primary" type="submit" value="login" disabled={busy}>
          Sign in
        </button>
        <button type="submit" value="register" disabled={busy}>
          Create account
        </button>
      </form>
      <div className="error">{error}</div>
    </section>
  );
}
