import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Avatar from '../components/Avatar.jsx';
import { mediaUrl } from '../lib/media.js';
import { timeAgo } from '../lib/time.js';

const TYPE_LABEL = { story: 'Story', user: 'Account', message: 'Direct message', reply: 'Story reply' };
const ACTION_LABEL = {
  dismiss: 'Dismiss (no violation)',
  remove: 'Remove content',
  suspend: 'Suspend account',
  remove_and_suspend: 'Remove + suspend',
};

function Preview({ item }) {
  const story = item.content.story ?? (item.targetType === 'story' ? item.snapshot : null);
  if (story) {
    return (
      <div className="mod-preview">
        <span className="mod-thumb" style={{ background: story.background }}>
          {story.type === 'image' && story.mediaUrl && <img src={mediaUrl(story.mediaUrl)} alt="Reported story" />}
          {story.type === 'video' && <span>▶ Video</span>}
          {story.type === 'text' && <span>{story.text}</span>}
        </span>
        <span className="small-text">
          {story.caption && <>Caption: “{story.caption}”<br /></>}
          {story.tags?.length > 0 && <>Tags: {story.tags.map((t) => `#${t}`).join(' ')}</>}
        </span>
      </div>
    );
  }
  if (item.targetType === 'user') {
    return (
      <p className="small-text">
        Bio: “{item.snapshot?.bio || '—'}”
      </p>
    );
  }
  return <p className="quote">“{item.snapshot?.text}”</p>;
}

function QueueItem({ item, resolved, onResolved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const actions = item.targetType === 'user' ? ['dismiss', 'suspend'] : ['dismiss', 'remove', 'suspend', 'remove_and_suspend'];

  const act = async (action) => {
    let note = '';
    if (action !== 'dismiss') {
      note = window.prompt(`${ACTION_LABEL[action]}: add a note for the record (optional)`, '') ?? null;
      if (note === null) return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/moderation/resolve', { method: 'POST', body: { targetType: item.targetType, targetId: item.targetId, action, note } });
      onResolved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <article className="mod-card" data-testid="mod-item" aria-label={`${TYPE_LABEL[item.targetType]} by ${item.targetUser?.username}`}>
      <header>
        <strong>{TYPE_LABEL[item.targetType]}</strong>
        <span className={`state-chip ${item.content.state}`}>{item.content.state}{item.content.hiddenReason === 'reports' ? ' (auto)' : ''}</span>
        <span className="grow" />
        <span className="chip">{item.reportCount} {item.reportCount === 1 ? 'report' : 'reports'}</span>
      </header>
      {item.targetUser && (
        <div className="list-row">
          <Avatar user={item.targetUser} size={32} />
          <Link to={`/u/${item.targetUser.username}`} className="grow">@{item.targetUser.username}</Link>
          {item.targetUser.suspended && <span className="state-chip removed">suspended</span>}
        </div>
      )}
      <Preview item={item} />
      <div className="chips">
        {Object.entries(item.reasons).map(([r, n]) => (
          <span key={r} className="chip">{r.replace('_', ' ')} × {n}</span>
        ))}
      </div>
      <ul className="list mod-reports">
        {item.reports.map((r) => (
          <li key={r.id}>
            @{r.reporter?.username ?? 'deleted'} · {r.reason.replace('_', ' ')} · {timeAgo(r.createdAt)} ago
            {r.details && <div className="muted">“{r.details}”</div>}
            {resolved && <div className="muted">→ {r.status} ({r.action})</div>}
          </li>
        ))}
      </ul>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!resolved && (
        <div className="mod-actions">
          {actions.map((a) => (
            <button key={a} type="button" className={`btn small ${a === 'dismiss' ? '' : 'danger'}`} disabled={busy} onClick={() => act(a)}>
              {ACTION_LABEL[a]}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

export default function Moderation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('open');
  const [data, setData] = useState(null);
  const [suspended, setSuspended] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setData(null);
    if (tab === 'suspended') {
      api('/moderation/suspended').then((d) => {
        setSuspended(d.users);
        setData({ items: [] });
      }).catch((e) => setError(e.message));
    } else {
      api(`/moderation/queue?status=${tab === 'open' ? 'open' : 'resolved'}`).then(setData).catch((e) => setError(e.message));
    }
  }, [tab]);

  useEffect(load, [load]);

  if (!user.isModerator) return <Navigate to="/" replace />;

  const unsuspend = async (username) => {
    await api(`/moderation/users/${username}/unsuspend`, { method: 'POST' });
    load();
  };

  return (
    <div className="page">
      <header className="top-bar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}>‹</button>
        <h1>Moderation</h1>
        <span />
      </header>
      <div className="segmented" role="tablist">
        {[['open', `Open${data?.openCount ? ` (${data.openCount})` : ''}`], ['resolved', 'Resolved'], ['suspended', 'Suspended']].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <p className="muted small-text">Aim to review every report within 24 hours. Content hidden by 3+ reports stays hidden until you act.</p>
      {error && <p className="form-error">{error}</p>}
      {!data ? (
        <p className="muted center">Loading…</p>
      ) : tab === 'suspended' ? (
        suspended.length === 0 ? (
          <p className="muted center">No suspended accounts.</p>
        ) : (
          <ul className="list">
            {suspended.map((u) => (
              <li key={u.id} className="list-row">
                <Avatar user={u} size={36} />
                <span className="grow">
                  @{u.username}
                  <br />
                  <span className="muted small-text">{u.suspended.reason} · {timeAgo(u.suspended.at)} ago</span>
                </span>
                <button type="button" className="btn small" onClick={() => unsuspend(u.username)}>Unsuspend</button>
              </li>
            ))}
          </ul>
        )
      ) : data.items.length === 0 ? (
        <p className="muted center">{tab === 'open' ? '🎉 Nothing to review.' : 'Nothing here yet.'}</p>
      ) : (
        data.items.map((item) => <QueueItem key={item.key} item={item} resolved={tab === 'resolved'} onResolved={load} />)
      )}
    </div>
  );
}
