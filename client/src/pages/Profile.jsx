import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Avatar from '../components/Avatar.jsx';
import Modal from '../components/Modal.jsx';
import StoryViewer from '../components/StoryViewer.jsx';
import { formatCount, timeAgo } from '../lib/time.js';

export default function Profile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [error, setError] = useState('');
  const [queue, setQueue] = useState(null);
  const [list, setList] = useState(null); // { title, users }
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([api(`/users/${username}`), api(`/highlights/user/${username}`)]);
      setProfile(p);
      setHighlights(h.highlights);
      setError('');
    } catch (e) {
      setError(e.message);
      setProfile(null);
    }
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <div className="page"><p className="muted center">{error}</p></div>;
  if (!profile) return <div className="page"><p className="muted center">Loading…</p></div>;

  const { user, counts, relationship, isMe, canView } = profile;

  const watchStories = async () => {
    const { author, stories } = await api(`/users/${user.username}/stories`);
    if (!stories.length) return;
    const firstUnseen = stories.findIndex((s) => !s.seenByMe);
    setQueue([{ kind: isMe ? 'mine' : 'friends', key: author.id, author, stories, startIndex: Math.max(0, firstUnseen) }]);
  };

  const watchHighlight = async (id) => {
    const { highlight } = await api(`/highlights/${id}`);
    if (!highlight.stories.length) return;
    setQueue([{ kind: 'highlight', key: highlight.id, title: highlight.title, author: user, stories: highlight.stories, startIndex: 0 }]);
  };

  const action = async (path, method) => {
    setMenuOpen(false);
    await api(`/users/${user.username}/${path}`, { method });
    load();
  };

  const showList = async (kind) => {
    if (!canView) return;
    const { users } = await api(`/users/${user.username}/${kind}`);
    setList({ title: kind === 'followers' ? 'Followers' : 'Following', users });
  };

  const followLabel = { accepted: 'Following', pending: 'Requested', none: relationship.followsYou ? 'Follow back' : 'Follow' }[relationship.following];

  return (
    <div className="page profile">
      <header className="top-bar">
        <h1>
          {user.username}
          {user.verified && <span className="verified" aria-label="verified">✓</span>}
          {profile.isPrivate && <span aria-label="private account"> 🔒</span>}
        </h1>
        {isMe ? (
          <Link to="/settings" className="icon-btn" aria-label="Settings">⚙</Link>
        ) : (
          <button type="button" className="icon-btn" aria-label="Profile options" onClick={() => setMenuOpen(true)}>⋯</button>
        )}
      </header>

      <section className="profile-head">
        <Avatar
          user={user}
          size={86}
          ring={profile.hasActiveStory ? (profile.hasUnseenStory ? 'unseen' : 'seen') : null}
          onClick={profile.hasActiveStory ? watchStories : undefined}
        />
        <div className="counts">
          <div><strong>{formatCount(counts.highlights)}</strong><span>highlights</span></div>
          <button type="button" onClick={() => showList('followers')}>
            <strong data-testid="followers-count">{formatCount(counts.followers)}</strong><span>followers</span>
          </button>
          <button type="button" onClick={() => showList('following')}>
            <strong>{formatCount(counts.following)}</strong><span>following</span>
          </button>
        </div>
      </section>

      <section className="bio">
        <strong>{user.displayName}</strong>
        {profile.lastActiveAt && (
          <span className="muted small-text" data-testid="active-status">
            {Date.now() - profile.lastActiveAt < 5 * 60 * 1000 ? 'Active now' : `Active ${timeAgo(profile.lastActiveAt)} ago`}
          </span>
        )}
        {user.bio && <p data-testid="bio">{user.bio}</p>}
        {user.website && (
          <a href={user.website} target="_blank" rel="noreferrer noopener">
            {user.website.replace(/^https?:\/\//, '')}
          </a>
        )}
        {user.interests?.length > 0 && (
          <div className="chips">
            {user.interests.map((t) => <span className="chip" key={t}>#{t}</span>)}
          </div>
        )}
      </section>

      <section className="profile-actions">
        {isMe ? (
          <>
            <Link className="btn" to="/edit-profile">Edit profile</Link>
            <Link className="btn" to="/archive">Archive</Link>
          </>
        ) : relationship.blocked ? (
          <button type="button" className="btn" onClick={() => action('block', 'DELETE')}>Unblock</button>
        ) : (
          <button
            type="button"
            className={`btn ${relationship.following === 'none' ? 'primary' : ''}`}
            onClick={() => action('follow', relationship.following === 'none' ? 'POST' : 'DELETE')}
          >
            {followLabel}
          </button>
        )}
        {!isMe && profile.messaging?.canMessage && (
          <Link className="btn" to={`/messages/${user.username}`}>Message</Link>
        )}
        {!isMe && relationship.followsYou && <span className="chip">Follows you</span>}
      </section>

      {canView ? (
        <section className="highlights" aria-label="Highlights">
          {isMe && (
            <Link to="/archive" className="highlight-item new" aria-label="New highlight">
              <span className="highlight-cover">＋</span>
              <span className="highlight-title">New</span>
            </Link>
          )}
          {highlights.map((h) => (
            <button type="button" key={h.id} className="highlight-item" onClick={() => watchHighlight(h.id)} data-testid="highlight">
              <span className="highlight-cover" style={{ background: h.cover?.background }}>
                {h.cover?.mediaUrl ? <img src={h.cover.mediaUrl} alt="" /> : <span className="cover-text">{h.cover?.text?.slice(0, 12)}</span>}
              </span>
              <span className="highlight-title">{h.title}</span>
            </button>
          ))}
          {!isMe && highlights.length === 0 && <p className="muted">No highlights yet.</p>}
        </section>
      ) : (
        <section className="private-notice">
          <p>🔒 This account is private</p>
          <p className="muted">Follow this account to see their stories and highlights.</p>
        </section>
      )}

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="sheet" role="menu" onClick={(e) => e.stopPropagation()}>
            <button type="button" role="menuitem" onClick={() => action('mute', relationship.muted ? 'DELETE' : 'POST')}>
              {relationship.muted ? 'Unmute' : 'Mute'} stories
            </button>
            <button type="button" role="menuitem" onClick={() => action('not-interested', relationship.notInterested ? 'DELETE' : 'POST')}>
              {relationship.notInterested ? 'Show in For You again' : 'Hide from For You'}
            </button>
            <button type="button" role="menuitem" className="danger" onClick={() => action('block', relationship.blocked ? 'DELETE' : 'POST')}>
              {relationship.blocked ? 'Unblock' : 'Block'}
            </button>
            <button type="button" role="menuitem" onClick={() => setMenuOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {list && (
        <Modal title={list.title} onClose={() => setList(null)}>
          {list.users.length === 0 ? (
            <p className="muted">Nobody yet.</p>
          ) : (
            <ul className="list">
              {list.users.map((u) => (
                <li key={u.id} className="list-row">
                  <Avatar user={u} size={36} />
                  <Link to={`/u/${u.username}`} className="grow" onClick={() => setList(null)}>
                    <strong>{u.username}</strong> <span className="muted">{u.displayName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {queue && (
        <StoryViewer
          initialQueue={queue}
          onClose={() => {
            setQueue(null);
            load();
          }}
          onStoryDeleted={() => load()}
        />
      )}
    </div>
  );
}
