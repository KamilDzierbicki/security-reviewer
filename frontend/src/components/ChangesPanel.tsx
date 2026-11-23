import type { ChangesView, IssueRef } from '../api/types.ts';

const SHOWN = 8;

function Column({
  title,
  items,
  empty,
}: {
  title: string;
  items: IssueRef[];
  empty: string;
}) {
  return (
    <div>
      <h3>
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="plain">
          {items.slice(0, SHOWN).map((issue) => (
            <li key={issue.id}>{issue.title}</li>
          ))}
          {items.length > SHOWN && (
            <li className="muted">+{items.length - SHOWN} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

export function ChangesPanel({ changes }: { changes: ChangesView }) {
  const added = [
    ...changes.new,
    ...changes.reopened.map((i) => ({ ...i, title: `${i.title} (reopened)` })),
  ];
  return (
    <div className="panel">
      <h2>Since the last scan</h2>
      {changes.isFirstScan && (
        <p className="muted">
          First scan of this repository: everything below is the baseline.
        </p>
      )}
      <div className="grid3">
        <Column title="New" items={added} empty="Nothing new." />
        <Column title="Fixed" items={changes.fixed} empty="Nothing fixed." />
        <Column
          title="Not verified"
          items={changes.notVerified}
          empty="All earlier issues were re-checked."
        />
      </div>
      {changes.secretsRemovedFromCode.length > 0 && (
        <div>
          <h3>
            Secrets removed from the code (
            {changes.secretsRemovedFromCode.length})
          </h3>
          <p className="muted">
            Not counted as fixed: they are still in the git history. Revoke and
            rotate each one if you have not done it yet.
          </p>
          <ul className="plain">
            {changes.secretsRemovedFromCode.map((issue) => (
              <li key={issue.id}>{issue.title}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
