import type {
  FindingView,
  RiskGroup,
  Severity,
  TopRisk,
} from '../api/types.ts';

export function SeverityPill({
  severity,
  label,
}: {
  severity: Severity;
  label?: string;
}) {
  return <span className={`pill sev-${severity}`}>{label ?? severity}</span>;
}

export function RiskCard({ risk }: { risk: TopRisk }) {
  const changed = risk.reportedSeverity !== risk.finalSeverity;
  return (
    <div className={`risk ${risk.finalSeverity}`}>
      <div className="row">
        <SeverityPill severity={risk.finalSeverity} />
        <span className="title">{risk.title}</span>
      </div>
      <div className="muted mono">{risk.location}</div>
      {changed && (
        <div className="muted">
          Scanner said {risk.reportedSeverity}; context makes it{' '}
          {risk.finalSeverity}.
        </div>
      )}
      {risk.why && <p style={{ margin: '8px 0 0' }}>{risk.why}</p>}
      <div className="factors">
        {risk.factors.map((f) => (
          <span key={f.name} className="factor" title={f.reason}>
            {f.name}: {f.level}
          </span>
        ))}
      </div>
      <div className="action">
        <strong>Next: </strong>
        {risk.nextAction}
      </div>
    </div>
  );
}

interface RiskListProps {
  risks: (RiskGroup & { findings: FindingView[] })[];
  rulesetVersion?: string;
}

export function RiskList({ risks, rulesetVersion }: RiskListProps) {
  return (
    <div className="panel">
      <h2>All risks ({risks.length})</h2>
      <p className="muted">Ranked by context. Ruleset {rulesetVersion}.</p>
      {risks.map((risk) => (
        <details key={risk.id}>
          <summary>
            <SeverityPill severity={risk.finalSeverity} /> {risk.title}
            <span className="muted"> {kindLabel(risk)}</span>
          </summary>
          <p className="muted">{risk.action}</p>
          <ul className="plain">
            {risk.findings.map((f) => (
              <li key={f.id}>
                <span className="mono">{f.ruleId}</span> {f.title}{' '}
                <span className="muted">
                  (reported {f.reportedSeverity}, score {f.riskScore})
                </span>
                {f.evidence.masked && (
                  <span className="mono muted"> {f.evidence.masked}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function kindLabel(risk: RiskGroup): string {
  switch (risk.kind) {
    case 'dependency':
      return `${risk.advisoryCount} ${risk.advisoryCount === 1 ? 'advisory' : 'advisories'}`;
    case 'secret':
      return 'secret';
    default: {
      const unhandled: never = risk.kind;
      return String(unhandled);
    }
  }
}
