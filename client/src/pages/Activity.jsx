import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Avatar from '../components/Avatar.jsx';
import ReportSheet from '../components/ReportSheet.jsx';
import { timeAgo } from '../lib/time.js';

const MESSAGES = {
  like: 'liked your story.',
  reply: 'replied to your story:',
  follow: 'started following you.',
  follow_request: 'requested to follow you.',
  follow_accepted: 'accepted your follow request.',
};

const SAFETY = { username: 'Storytime Safety', displayName: 'Storytime Safety', avatarUrl: null };

export default function Activity() {
  const [tab, setTab] = useState('notifications');
  const [notifications, setNotifications] = useState(null);
  const [replies, setReplies] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reporting, setReporting] = useState(null);

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
      {reporting && (
        <ReportSheet
          targetType="reply"
          targetId={reporting.id}
          username={reporting.from.username}
          onClose={() => setReporting(null)}
          onDone={(res) => res.blocked && setReplies((list) => list.filter((x) => x.from.id !== reporting.from.id))}
        />
      )}
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
            {notifications.map((n) =>
              n.actor ? (
                <li key={n.id} className={`list-row ${n.read ? '' : 'unread'}`}>
                  <Avatar user={n.actor} size={40} />
                  <span className="grow">
                    <Link to={`/u/${n.actor.username}`}><strong>{n.actor.username}</strong></Link> {MESSAGES[n.type]}
                    {n.text && <span className="quote"> “{n.text}”</span>}
                    <span className="muted"> {timeAgo(n.createdAt)}</span>
                  </span>
                </li>
              ) : (
                <li key={n.id} className={`list-row ${n.read ? '' : 'unread'}`} data-testid="safety-notice">
                  <Avatar user={SAFETY} size={40} />
                  <span className="grow">
                    <strong>Storytime Safety</strong> {n.text}
                    <span className="muted"> {timeAgo(n.createdAt)}</span>
                  </span>
                </li>
              ),
            )}
          </ul>
        )
      ) : replies.length === 0 ? (
        <p className="muted center">
          No replies yet. Replies from people you both follow go to <Link to="/messages">Messages</Link>.
        </p>
      ) : (
        <ul className="list" aria-label="Story replies">
          {replies.map((r) => (
            <li key={r.id} className="list-row">
              <Avatar user={r.from} size={40} />
              <span className="grow">
                <Link to={`/u/${r.from.username}`}><strong>{r.from.username}</strong></Link>
                <span className="reply-text">{r.text}</span>
                {r.canMessage ? (
                  <Link to={`/messages/${r.from.username}`} className="small-text">Message {r.from.username}</Link>
                ) : (
                  <span className="muted small-text">One-way reply · follow each other to chat</span>
                )}
                {' · '}
                <button type="button" className="link-btn small-text danger" onClick={() => setReporting(r)}>Report</button>
              </span>
              <span className="muted">{timeAgo(r.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
