import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

/** Blocks the app until the user accepts updated Terms / Community Guidelines. */
export default function TermsGate() {
  const { setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    const { user } = await api('/auth/accept-terms', { method: 'POST' });
    setUser(user);
  };
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Updated terms">
        <div className="modal-body stack">
          <h2>We've updated our terms</h2>
          <p>
            To keep using Storytime, please review and accept our <Link to="/terms">Terms of Use</Link> and{' '}
            <Link to="/guidelines">Community Guidelines</Link>. There's no tolerance for objectionable content or abusive
            behaviour, and you can report anything that breaks the rules.
          </p>
          <p className="small-text muted">
            Our <Link to="/privacy">Privacy Policy</Link> explains how we handle your data.
          </p>
          <button type="button" className="btn primary block" disabled={busy} onClick={accept}>I agree</button>
        </div>
      </div>
    </div>
  );
}
