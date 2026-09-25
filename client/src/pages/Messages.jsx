import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Avatar from '../components/Avatar.jsx';
import Modal from '../components/Modal.jsx';
import { timeAgo } from '../lib/time.js';

function preview({ lastMessage }) {
  const prefix = lastMessage.isStoryReply
    ? lastMessage.fromMe
      ? 'You replied to their story: '
      : 'Replied to your story: '
    : lastMessage.fromMe
      ? 'You: '
      : '';
  return prefix + lastMessage.text;
}

export default function Messages() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState(null);
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/messages')
      .then((d) => setConversations(d.conversations))
      .catch((e) => setError(e.message));
  }, []);

  const openNew = async () => {
    const { users } = await api('/messages/contacts');
    setContacts(users);
  };

  return (
    <div className="page">
      <header className="top-bar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}>‹</button>
        <h1>Messages</h1>
        <button type="button" className="icon-btn" aria-label="New message" onClick={openNew}>✎</button>
      </header>
      {error && <p className="form-error">{error}</p>}
      {conversations === null ? (
        <p className="muted center">Loading…</p>
      ) : conversations.length === 0 ? (
        <div className="empty-state">
          <p><strong>No messages yet</strong></p>
          <p className="muted">
            You can message anyone you follow who follows you back. Story replies from other people show up
            in <Link to="/activity">Activity</Link>.
          </p>
          <button type="button" className="btn primary" onClick={openNew}>Send a message</button>
        </div>
      ) : (
        <ul className="list" aria-label="Conversations">
          {conversations.map((c) => (
            <li key={c.user.id}>
              <Link to={`/messages/${c.user.username}`} className={`list-row convo-row ${c.unread ? 'unread-convo' : ''}`} data-testid="conversation">
                <Avatar user={c.user} size={52} />
                <span className="grow">
                  <strong>{c.user.username}</strong>
                  <span className="convo-preview">
                    {preview(c)} · {timeAgo(c.lastMessage.createdAt)}
                  </span>
                  {!c.canMessage && <span className="muted small-text">Read only</span>}
                </span>
                {c.unread > 0 && <span className="unread-dot" aria-label={`${c.unread} unread`} />}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {contacts && (
        <Modal title="New message" onClose={() => setContacts(null)}>
          {contacts.length === 0 ? (
            <p className="muted">
              Nobody to message yet. You can message people once you both follow each other.
            </p>
          ) : (
            <ul className="list">
              {contacts.map((u) => (
                <li key={u.id}>
                  <button type="button" className="list-row plain" onClick={() => navigate(`/messages/${u.username}`)}>
                    <Avatar user={u} size={40} />
                    <span className="grow">
                      <strong>{u.username}</strong> <span className="muted">{u.displayName}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
