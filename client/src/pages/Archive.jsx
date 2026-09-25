import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import HighlightPicker from '../components/HighlightPicker.jsx';
import { formatDate, timeLeft } from '../lib/time.js';

/** Every story you've posted (active and expired), selectable into highlights. */
export default function Archive() {
  const navigate = useNavigate();
  const [stories, setStories] = useState(null);
  const [selected, setSelected] = useState([]);
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    api('/stories/archive').then((d) => setStories(d.stories));
  }, []);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="page">
      <header className="top-bar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}>‹</button>
        <h1>Archive</h1>
        <button
          type="button"
          className="link-btn"
          disabled={!selected.length}
          onClick={() => setPicking(true)}
        >
          Add to highlight{selected.length ? ` (${selected.length})` : ''}
        </button>
      </header>
      <p className="muted small-text pad">Only you can see your archive. Select stories to save them as highlights on your profile.</p>
      {status && <p className="form-success" role="status">{status}</p>}
      {stories === null ? (
        <p className="muted center">Loading…</p>
      ) : stories.length === 0 ? (
        <p className="muted center">You haven't posted any stories yet.</p>
      ) : (
        <div className="archive-grid">
          {stories.map((s) => (
            <button
              type="button"
              key={s.id}
              className={`archive-tile ${selected.includes(s.id) ? 'selected' : ''}`}
              style={{ background: s.background }}
              aria-pressed={selected.includes(s.id)}
              aria-label={`Story from ${formatDate(s.createdAt)}`}
              onClick={() => toggle(s.id)}
              data-testid="archive-tile"
            >
              {s.type === 'image' && <img src={s.mediaUrl} alt="" />}
              {s.type === 'video' && <video src={s.mediaUrl} muted preload="metadata" />}
              {s.type === 'text' && <span className="tile-text">{s.text}</span>}
              <span className="tile-date">{s.expired ? formatDate(s.createdAt) : timeLeft(s.expiresAt)}</span>
              {selected.includes(s.id) && <span className="tile-check">✓</span>}
            </button>
          ))}
        </div>
      )}
      {picking && (
        <HighlightPicker
          storyIds={selected}
          onClose={() => setPicking(false)}
          onSaved={(_h, msg) => {
            setStatus(msg);
            setSelected([]);
          }}
        />
      )}
    </div>
  );
}
