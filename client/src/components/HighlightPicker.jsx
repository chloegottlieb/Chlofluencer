import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Modal from './Modal.jsx';

/** Save one or more of your stories into a new or existing highlight. */
export default function HighlightPicker({ storyIds, onClose, onSaved }) {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/highlights/user/${user.username}`)
      .then((d) => setHighlights(d.highlights))
      .catch((e) => setError(e.message));
  }, [user.username]);

  const done = (highlight, message) => {
    onSaved?.(highlight, message);
    onClose();
  };

  const addTo = async (h) => {
    setBusy(true);
    setError('');
    try {
      const { highlight } = await api(`/highlights/${h.id}`, { method: 'PATCH', body: { addStoryIds: storyIds } });
      done(highlight, `Added to ${h.title}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { highlight } = await api('/highlights', { method: 'POST', body: { title, storyIds } });
      done(highlight, `Saved to new highlight ${highlight.title}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Add to highlight" onClose={onClose}>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={create} className="inline-form">
        <input
          aria-label="New highlight name"
          placeholder="New highlight name"
          value={title}
          maxLength={30}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="btn primary" type="submit" disabled={busy || !title.trim()}>
          Create
        </button>
      </form>
      {highlights === null ? (
        <p className="muted">Loading…</p>
      ) : highlights.length === 0 ? (
        <p className="muted">You don't have any highlights yet.</p>
      ) : (
        <ul className="list" aria-label="Your highlights">
          {highlights.map((h) => (
            <li key={h.id} className="list-row">
              <span className="highlight-cover small" style={{ background: h.cover?.background }}>
                {h.cover?.mediaUrl && <img src={h.cover.mediaUrl} alt="" />}
              </span>
              <span className="grow">
                {h.title} <span className="muted">· {h.storyCount}</span>
              </span>
              <button type="button" className="btn" disabled={busy} onClick={() => addTo(h)}>
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
