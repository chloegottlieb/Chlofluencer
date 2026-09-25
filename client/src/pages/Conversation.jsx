import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Avatar from '../components/Avatar.jsx';
import ReportSheet from '../components/ReportSheet.jsx';
import { timeAgo } from '../lib/time.js';
import { mediaUrl } from '../lib/media.js';

const POLL_MS = 4000;

function StoryRef({ story, fromMe }) {
  const label = fromMe ? 'You replied to their story' : 'Replied to your story';
  if (!story.available) {
    return <span className="story-ref unavailable">{label} · Story unavailable</span>;
  }
  return (
    <span className="story-ref">
      <span className="muted small-text">{label}</span>
      <span className="story-ref-thumb" style={{ background: story.background }}>
        {story.type === 'image' && <img src={mediaUrl(story.mediaUrl)} alt="" />}
        {story.type === 'video' && <video src={mediaUrl(story.mediaUrl)} muted preload="metadata" />}
        {story.type === 'text' && <span>{story.text}</span>}
      </span>
    </span>
  );
}

export default function Conversation() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState(null);
  const bottomRef = useRef(null);
  const countRef = useRef(0);
  const blockedRef = useRef(false);

  const load = useCallback(
    () =>
      api(`/messages/${username}`)
        .then((d) => setThread(d))
        .catch((e) => setError(e.message)),
    [username],
  );

  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Keep the newest message in view when new ones arrive.
  useEffect(() => {
    const n = thread?.messages.length ?? 0;
    if (n !== countRef.current) {
      countRef.current = n;
      bottomRef.current?.scrollIntoView?.({ block: 'end' });
    }
  }, [thread]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const { message } = await api(`/messages/${username}`, { method: 'POST', body: { text: body } });
      setThread((t) => ({ ...t, messages: [...t.messages, message] }));
      setText('');
      setError('');
    } catch (err) {
      setError(err.message);
      load(); // e.g. someone unfollowed: refresh so the composer locks.
    } finally {
      setSending(false);
    }
  };

  if (!thread) {
    return <div className="page"><p className="muted center">{error || 'Loading…'}</p></div>;
  }

  return (
    <div className="page conversation">
      <header className="top-bar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate('/messages')}>‹</button>
        <Link to={`/u/${thread.user.username}`} className="convo-title">
          <Avatar user={thread.user} size={32} />
          <strong>{thread.user.username}</strong>
        </Link>
        <span />
      </header>

      <ol className="messages" aria-label={`Conversation with ${thread.user.username}`}>
        {thread.messages.length === 0 && (
          <li className="muted center small-text">Say hi to {thread.user.displayName} 👋</li>
        )}
        {thread.messages.map((m) => (
          <li key={m.id} className={`bubble-row ${m.fromMe ? 'mine' : 'theirs'}`} data-testid="message">
            {m.story && <StoryRef story={m.story} fromMe={m.fromMe} />}
            <span className="bubble">{m.text}</span>
            <span className="bubble-time bubble-actions">
              {timeAgo(m.createdAt)}
              {m.fromMe && m.readAt && ' · Seen'}
              {!m.fromMe && (
                <button type="button" aria-label="Report message" onClick={() => setReporting(m.id)}>Report</button>
              )}
            </span>
          </li>
        ))}
        <li ref={bottomRef} aria-hidden />
      </ol>

      {reporting && (
        <ReportSheet
          targetType="message"
          targetId={reporting}
          username={thread.user.username}
          onDone={(res) => (blockedRef.current = !!res.blocked)}
          onClose={() => {
            setReporting(null);
            if (blockedRef.current) navigate('/messages');
          }}
        />
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {thread.canMessage ? (
        <form className="composer" onSubmit={send}>
          <input
            aria-label="Message"
            placeholder="Message…"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="link-btn" disabled={sending || !text.trim()}>Send</button>
        </form>
      ) : (
        <div className="composer locked" data-testid="read-only">
          <p>{thread.message}</p>
          {thread.reason === 'not_mutual' && (
            <Link to={`/u/${thread.user.username}`} className="btn small">View profile</Link>
          )}
        </div>
      )}
    </div>
  );
}
