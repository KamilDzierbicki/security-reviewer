import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client.ts';
import type { RepositoryView, StatusView } from '../api/types.ts';

interface Props {
  version: number;
  onOpenScan: (runId: string) => void;
  handleError: (error: unknown) => string;
}

export function RepositoriesPanel({ version, onOpenScan, handleError }: Props) {
  const [repos, setRepos] = useState<RepositoryView[] | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState<string | null>(null);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    api<RepositoryView[]>('/repositories').then(
      (list) => current && setRepos(list),
      (e: unknown) => current && setError(handleError(e)),
    );
    return () => {
      current = false;
    };
  }, [handleError, version, reload]);

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      await api('/repositories', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      setUrl('');
      setReload((n) => n + 1);
    } catch (e) {
      setError(handleError(e));
    }
  };

  const scan = async (repositoryId: string) => {
    setError('');
    setStarting(repositoryId);
    try {
      const run = await api<StatusView>(`/repositories/${repositoryId}/scans`, {
        method: 'POST',
      });
      onOpenScan(run.id);
    } catch (e) {
      setError(handleError(e));
    } finally {
      setStarting(null);
    }
  };

  return (
    <section className="panel">
      <h2>Repositories</h2>
      <form className="row" onSubmit={add}>
        <input
          placeholder="https://github.com/owner/name"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="primary" type="submit">
          Add repository
        </button>
      </form>
      <div className="error">{error}</div>
      {repos?.length === 0 && (
        <p className="muted">Add a public GitHub repository to scan it.</p>
      )}
      {repos?.map((repo) => (
        <div className="repo" key={repo.id}>
          <div>
            <a href={repo.url} target="_blank" rel="noopener noreferrer">
              {repo.fullName}
            </a>{' '}
            {repo.latestRun ? (
              <span className={`status ${repo.latestRun.status}`}>
                {repo.latestRun.status}
              </span>
            ) : (
              <span className="muted">never scanned</span>
            )}
          </div>
          <div className="row">
            {repo.latestRun && (
              <button onClick={() => onOpenScan(repo.latestRun!.id)}>
                View last scan
              </button>
            )}
            <button
              className="primary"
              disabled={starting === repo.id}
              onClick={() => void scan(repo.id)}
            >
              Scan latest
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
