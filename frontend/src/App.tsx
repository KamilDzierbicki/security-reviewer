import { useCallback, useEffect, useState } from 'react';
import {
  getEmail,
  getToken,
  setSession,
  UnauthorizedError,
} from './api/client.ts';
import { AuthPanel } from './components/AuthPanel.tsx';
import { RepositoriesPanel } from './components/RepositoriesPanel.tsx';
import { ScanView } from './components/ScanView.tsx';

function runIdFromHash(): string | null {
  return /^#\/scans\/([0-9a-f-]{36})$/.exec(window.location.hash)?.[1] ?? null;
}

function openScan(runId: string): void {
  window.location.hash = `/scans/${runId}`;
}

export function App() {
  const [token, setTokenState] = useState(getToken);
  const [email, setEmail] = useState(getEmail);
  const [runId, setRunId] = useState(runIdFromHash);
  const [reposVersion, setReposVersion] = useState(0);

  useEffect(() => {
    const onHashChange = () => setRunId(runIdFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const signIn = (accessToken: string, userEmail: string) => {
    setSession({ token: accessToken, email: userEmail });
    setTokenState(accessToken);
    setEmail(userEmail);
  };

  const signOut = useCallback(() => {
    setSession(null);
    setTokenState(null);
    setEmail('');
  }, []);

  const handleError = useCallback(
    (error: unknown): string => {
      if (error instanceof UnauthorizedError) signOut();
      return error instanceof Error ? error.message : 'Request failed';
    },
    [signOut],
  );

  const onScanSettled = useCallback(() => setReposVersion((v) => v + 1), []);

  return (
    <>
      <header>
        <h1>Scan Review</h1>
        {token && (
          <div className="row">
            <span className="muted">{email}</span>
            <button onClick={signOut}>Sign out</button>
          </div>
        )}
      </header>
      <main>
        {token ? (
          <>
            <RepositoriesPanel
              version={reposVersion}
              onOpenScan={openScan}
              handleError={handleError}
            />
            {runId && (
              <ScanView
                key={runId}
                runId={runId}
                handleError={handleError}
                onSettled={onScanSettled}
              />
            )}
          </>
        ) : (
          <AuthPanel onSignedIn={signIn} />
        )}
      </main>
    </>
  );
}
