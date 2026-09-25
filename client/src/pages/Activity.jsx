import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Avatar from '../components/Avatar.jsx';
import { timeAgo } from '../lib/time.js';

const MESSAGES = {
  like: 'liked your story.',
  reply: 'replied to your story:',
  follow: 'started following you.',
  follow_request: 'requested to follow you.',
  follow_accepted: 'accepted your follow request.',
};

export default function Activity() {
  const [tab, setTab] = useState('notifications');
  const [notifications, setNotifications] = useState(null);
  const [replies, setReplies] = useState([]);
  const [requests, setRequests] = useState([]);

  const load = () => {
    api('/notifications').then((d) => {
      setNotifications(d.notifications);
      if (d.unread) api('/notifications/read', { method: 'POST' }).catch(() => {});
    });
    api('/stories/replies').then((d) => setReplies(d.replies));
    api('/users/me/requests').then((d) => setRequests(d.requests));
  };
  useEffect(load, []);

  const respond = async (userId, action) => {
    await api(`/users/me/requests/${userId}/${action}`, { method: 'POST' });
    setRequests((r) => r.filter((x) => x.user.id !== userId));
  };

  return (
    <div className="page">
      <header className="top-bar">
        <h1>Activity</h1>
      </header>
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'notifications'} className={tab === 'notifications' ? 'active' : ''} onClick={() => setTab('notifications')}>
          Notifications
        </button>
        <button type="button" role="tab" aria-selected={tab === 'replies'} className={tab === 'replies' ? 'active' : ''} onClick={() => setTab('replies')}>
          Story replies {replies.length > 0 && `(${replies.length})`}
        </button>
      </div>

      {requests.length > 0 && (
        <section aria-label="Follow requests">
          <h2 className="section-title">Follow requests</h2>
          <ul className="list">
            {requests.map((r) => (
              <li key={r.user.id} className="list-row">
                <Avatar user={r.user} size={40} />
                <Link to={`/u/${r.user.username}`} className="grow">{r.user.username}</Link>
                <button type="button" className="btn primary small" onClick={() => respond(r.user.id, 'accept')}>Confirm</button>
                <button type="button" className="btn small" onClick={() => respond(r.user.id, 'decline')}>Delete</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'notifications' ? (
        notifications === null ? (
          <p className="muted center">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="muted center">No activity yet. Post a story to get started!</p>
        ) : (
          <ul className="list" aria-label="Notifications">
            {notifications.map((n) => (
              <li key={n.id} className={`list-row ${n.read ? '' : 'unread'}`}>
                <Avatar user={n.actor} size={40} />
                <span className="grow">
                  <Link to={`/u/${n.actor.username}`}><strong>{n.actor.username}</strong></Link> {MESSAGES[n.type]}
                  {n.text && <span className="quote"> “{n.text}”</span>}
                  <span className="muted"> {timeAgo(n.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )
      ) : replies.length === 0 ? (
        <p className="muted center">No replies yet.</p>
      ) : (
        <ul className="list" aria-label="Story replies">
          {replies.map((r) => (
            <li key={r.id} className="list-row">
              <Avatar user={r.from} size={40} />
              <span className="grow">
                <Link to={`/u/${r.from.username}`}><strong>{r.from.username}</strong></Link>
                <br />
                {r.text}
              </span>
              <span className="muted">{timeAgo(r.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
