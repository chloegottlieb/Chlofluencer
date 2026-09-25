import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, qs } from '../api.js';
import { useAuth } from '../auth.jsx';
import Avatar from '../components/Avatar.jsx';
import MessagesLink from '../components/MessagesLink.jsx';
import StoryViewer from '../components/StoryViewer.jsx';
import { buildQueue, markSeen } from '../lib/player.js';
import { mediaUrl } from '../lib/media.js';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState('');
  const [viewerQueue, setViewerQueue] = useState(null);

  const load = useCallback(() => {
    api('/feed')
      .then((f) => {
        setFeed(f);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const open = (start) => {
    const queue = buildQueue(feed, { start });
    if (queue.length) setViewerQueue(queue);
  };

  const onSeen = useCallback((storyId) => {
    setFeed((f) => f && { ...f, friends: markSeen(f.friends, storyId), discover: markSeen(f.discover, storyId) });
  }, []);

  const loadMore = useCallback(async (exclude) => {
    const d = await api(`/feed/discover${qs({ exclude: exclude.join(','), limit: 10 })}`);
    return { groups: d.discover, hasMore: d.discoverHasMore };
  }, []);

  const closeViewer = useCallback(() => {
    setViewerQueue(null);
    load();
  }, [load]);

  if (error) return <div className="page"><p className="form-error">{error}</p></div>;
  if (!feed) return <div className="page"><p className="muted center">Loading stories…</p></div>;

  const hasMine = feed.me.stories.length > 0;
  const unseenFriends = feed.friends.filter((g) => g.hasUnseen).length;

  return (
    <div className="page home">
      <header className="top-bar">
        <h1 className="logo">Storytime</h1>
        <span className="top-actions">
          <MessagesLink />
          <Link to="/settings" className="icon-btn" aria-label="Settings">⚙</Link>
        </span>
      </header>

      <section className="tray" aria-label="Stories">
        <div className="tray-item">
          <div className="tray-avatar-wrap">
            <Avatar
              user={user}
              size={66}
              ring={hasMine ? 'seen' : null}
              onClick={() => (hasMine ? open('me') : navigate('/create'))}
            />
            <Link to="/create" className="tray-plus" aria-label="Add to your story">+</Link>
          </div>
          <span className="tray-name">Your story</span>
        </div>
        {feed.friends.map((g) => (
          <div className="tray-item" key={g.author.id} data-testid="friend-ring">
            <Avatar user={g.author} size={66} ring={g.hasUnseen ? 'unseen' : 'seen'} onClick={() => open(g.author.id)} />
            <span className="tray-name">{g.author.username}</span>
          </div>
        ))}
      </section>

      <section className="watch-cta">
        {unseenFriends > 0 ? (
          <button type="button" className="btn primary block" onClick={() => open()}>
            ▶ Watch {unseenFriends} {unseenFriends === 1 ? 'friend' : 'friends'}' stories
          </button>
        ) : (
          <p className="muted center">
            {feed.friends.length ? "You're caught up with friends." : 'Follow people to see their stories here.'}
          </p>
        )}
      </section>

      {feed.discoverEnabled ? (
        <section className="discover" aria-label="For You">
          <div className="section-head">
            <h2>For You</h2>
            {feed.discover.length > 0 && (
              <button type="button" className="link-btn" onClick={() => open('discover')}>
                Start watching
              </button>
            )}
          </div>
          {feed.discover.length === 0 ? (
            <p className="muted">No new creators right now. Check back soon!</p>
          ) : (
            <div className="discover-grid">
              {feed.discover.map((g) => {
                const cover = g.stories[0];
                return (
                  <button
                    type="button"
                    key={g.author.id}
                    className="discover-card"
                    data-testid="discover-card"
                    onClick={() => open(`discover:${g.author.id}`)}
                    style={{ background: cover.background }}
                  >
                    {cover.type === 'image' && <img src={mediaUrl(cover.mediaUrl)} alt="" />}
                    {cover.type === 'text' && <span className="discover-text">{cover.text}</span>}
                    {cover.type === 'video' && <span className="discover-text">▶ Video</span>}
                    <span className="discover-overlay">
                      <Avatar user={g.author} size={28} />
                      <span className="discover-name">{g.author.username}</span>
                      {g.reasons?.[0] && <span className="discover-reason">{g.reasons[0]}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <p className="muted center">
          Discovery is off. Turn on <Link to="/settings">“Discover new creators”</Link> to keep watching after your friends.
        </p>
      )}

      {viewerQueue && (
        <StoryViewer
          initialQueue={viewerQueue}
          onClose={closeViewer}
          onSeen={onSeen}
          loadMore={feed.discoverEnabled ? loadMore : null}
        />
      )}
    </div>
  );
}
