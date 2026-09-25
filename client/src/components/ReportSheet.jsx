import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Modal from './Modal.jsx';

const TITLES = { story: 'Report story', user: 'Report account', message: 'Report message', reply: 'Report reply' };

/**
 * Report flow: pick a reason → optional details (+ block) → confirmation.
 * Reports are anonymous: the person reported is never told who reported them.
 */
export default function ReportSheet({ targetType, targetId, username, onClose, onDone }) {
  const [reasons, setReasons] = useState(null);
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [block, setBlock] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api('/reports/reasons')
      .then((d) => setReasons(d.reasons))
      .catch((e) => setError(e.message));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api('/reports', { method: 'POST', body: { targetType, targetId, reason, details, block } });
      setResult(res);
      onDone?.(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={TITLES[targetType]} onClose={onClose}>
      {result ? (
        <div className="report-done" data-testid="report-done">
          <div className="report-icon" aria-hidden>🛡️</div>
          <p><strong>Thanks for letting us know</strong></p>
          <p className="muted">
            Our team reviews reports within 24 hours. {username ? `@${username} won't know you reported them.` : ''}
            {result.blocked && ` You've blocked @${username}.`}
          </p>
          <Link to="/guidelines" onClick={onClose}>Read our Community Guidelines</Link>
          <button type="button" className="btn block" onClick={onClose}>Done</button>
        </div>
      ) : !reason ? (
        <>
          <p className="muted small-text">Why are you reporting this? Your report is anonymous.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {!reasons && !error && <p className="muted">Loading…</p>}
          <ul className="list" aria-label="Report reasons">
            {reasons &&
              Object.entries(reasons).map(([key, label]) => (
                <li key={key}>
                  <button type="button" className="list-row plain reason-row" onClick={() => setReason(key)}>
                    <span className="grow">{label}</span>
                    <span aria-hidden>›</span>
                  </button>
                </li>
              ))}
          </ul>
          <p className="muted small-text">
            If someone is in immediate danger, call your local emergency number.
          </p>
        </>
      ) : (
        <form onSubmit={submit} className="stack">
          <p>
            <strong>{reasons[reason]}</strong>{' '}
            <button type="button" className="link-btn" onClick={() => setReason(null)}>Change</button>
          </p>
          <label>
            <span>Anything else we should know? (optional)</span>
            <textarea aria-label="Report details" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
          </label>
          {username && (
            <label className="setting-row">
              <span className="setting-label">Also block @{username}</span>
              <input type="checkbox" role="switch" className="switch" checked={block} onChange={(e) => setBlock(e.target.checked)} aria-label={`Also block @${username}`} />
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn danger block" disabled={busy}>
            {busy ? 'Sending…' : 'Submit report'}
          </button>
        </form>
      )}
    </Modal>
  );
}
