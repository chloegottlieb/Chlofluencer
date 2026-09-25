import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { timeAgo } from '../lib/time.js';
import Avatar from './Avatar.jsx';
import Modal from './Modal.jsx';

export default function ViewersSheet({ storyId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/stories/${storyId}/viewers`).then(setData).catch((e) => setError(e.message));
  }, [storyId]);

  return (
    <Modal title="Story insights" onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <>
          <div className="stats-row">
            <div><strong data-testid="viewer-total">{data.total}</strong><span>Views</span></div>
            <div><strong>{data.discoverViews}</strong><span>From For You</span></div>
            <div><strong>{data.likes}</strong><span>Likes</span></div>
          </div>
          {data.viewers.length === 0 ? (
            <p className="muted">No views yet.</p>
          ) : (
            <ul className="list">
              {data.viewers.map((v) => (
                <li key={v.user.id} className="list-row">
                  <Avatar user={v.user} size={36} />
                  <Link to={`/u/${v.user.username}`} className="grow" onClick={onClose}>
                    {v.user.username}
                  </Link>
                  {v.liked && <span aria-label="liked">❤️</span>}
                  {v.source === 'discover' && <span className="chip">For You</span>}
                  <span className="muted">{timeAgo(v.viewedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
