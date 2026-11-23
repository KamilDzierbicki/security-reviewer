import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.ts';
import { followScan } from '../api/sse.ts';
import type { ResultView, StatusView } from '../api/types.ts';
import { ChangesPanel } from './ChangesPanel.tsx';
import { RiskCard, RiskList, SeverityPill } from './Risks.tsx';

interface Props {
  runId: string;
  handleError: (error: unknown) => string;
  onSettled: () => void;
}

export function ScanView({ runId, handleError, onSettled }: Props) {
  const [status, setStatus] = useState<StatusView | null>(null);
  const [result, setResult] = useState<ResultView | null>(null);
  const [error, setError] = useState('');
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const controller = new AbortController();
    const run = async () => {
      try {
        const last = await followScan(runId, setStatus, controller.signal);
        if (!last) return;
        setResult(await api<ResultView>(`/scans/${runId}/result`));
        onSettled();
      } catch (e) {
        if (!controller.signal.aborted) setError(handleError(e));
      }
    };
    void run();
    return () => controller.abort();
  }, [runId, handleError, onSettled]);

  let body;
  if (error) body = <div className="panel error">{error}</div>;
  else if (result) body = <Result result={result} />;
  else if (status) body = <Progress status={status} />;
  else body = <div className="panel muted">Loading scan...</div>;
  return <section ref={ref}>{body}</section>;
}

function ScanHeader({ status }: { status: StatusView }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <div>
        <h2 style={{ margin: 0 }}>{status.repository.fullName}</h2>
        <span className="muted mono">
          {status.commitSha
            ? `commit ${status.commitSha.slice(0, 12)}`
            : 'resolving commit'}
        </span>
      </div>
      <span className={`status ${status.status}`}>{status.status}</span>
    </div>
  );
}

function Progress({ status }: { status: StatusView }) {
  const scanners = status.scanners
    .map(
      (s) =>
        `${s.name} ${s.status}${s.findingCount !== null ? ` (${s.findingCount})` : ''}`,
    )
    .join(', ');
  return (
    <div className="panel">
      <ScanHeader status={status} />
      <div className="bar">
        <div style={{ width: `${status.progress}%` }} />
      </div>
      <ul className="stages">
        {status.stages.map((stage) => (
          <li key={stage.name}>
            <span className={`dot ${stage.status}`} />
            <span>
              {stage.label}
              {stage.name === 'scan' && scanners && (
                <span className="muted">: {scanners}</span>
              )}
            </span>
            {stage.note && <span className="muted"> ({stage.note})</span>}
          </li>
        ))}
      </ul>
      {status.error && <p className="error">{status.error}</p>}
    </div>
  );
}

const COUNTED = ['critical', 'high', 'medium', 'low'] as const;

function Result({ result }: { result: ResultView }) {
  const { summary, severityCounts, totals } = result;
  return (
    <>
      <div className="panel">
        <ScanHeader status={result.run} />
        {result.run.error && <p className="error">{result.run.error}</p>}
      </div>

      {summary && (
        <div className="panel">
          <div className="muted">
            {summary.source === 'llm'
              ? 'AI summary of the deterministic ranking'
              : 'Summary'}
          </div>
          <div className="headline">{summary.headline}</div>
          <p style={{ margin: 0 }}>{summary.overview}</p>
          {severityCounts && totals && (
            <div className="counts">
              {COUNTED.map((severity) => (
                <SeverityPill
                  key={severity}
                  severity={severity}
                  label={`${severityCounts[severity]} ${severity}`}
                />
              ))}
              <span className="muted">
                {totals.risks} risks from {totals.findings} findings
              </span>
            </div>
          )}
        </div>
      )}

      {result.topRisks.length > 0 && (
        <div className="panel">
          <h2>Fix these first</h2>
          {result.topRisks.map((risk) => (
            <RiskCard key={risk.id} risk={risk} />
          ))}
        </div>
      )}

      {result.changes && <ChangesPanel changes={result.changes} />}

      {result.risks.length > 0 && (
        <RiskList risks={result.risks} rulesetVersion={result.rulesetVersion} />
      )}
    </>
  );
}
