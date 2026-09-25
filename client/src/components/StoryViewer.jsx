import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  INTERSTITIAL,
  appendDiscover,
  currentStory,
  initialCursor,
  next as nextCursor,
  nextGroup,
  prev as prevCursor,
  shouldLoadMore,
  storyDuration,
} from '../lib/player.js';
import { timeAgo } from '../lib/time.js';
import Avatar from './Avatar.jsx';
import HighlightPicker from './HighlightPicker.jsx';
import StoryContent from './StoryContent.jsx';
import ViewersSheet from './ViewersSheet.jsx';

const TICK_MS = 50;
const HOLD_MS = 220;

const SOURCE_BY_KIND = { friends: 'friends', discover: 'discover', highlight: 'highlight', mine: 'friends' };

/**
 * Full-screen, Instagram-style story player.
 * Tap right = next, tap left = previous, press-and-hold = pause,
 * swipe down / Esc = close, swipe left/right = skip creator.
 */
export default function StoryViewer({ initialQueue, onClose, loadMore, onSeen, onStoryDeleted }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const playback = user?.settings?.playback ?? {};

  const [queue, setQueue] = useState(initialQueue);
  const [cursor, setCursor] = useState(() => initialCursor(initialQueue));
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [muted, setMuted] = useState(!!playback.muteByDefault);
  const [panel, setPanel] = useState(null); // 'menu' | 'highlight' | 'viewers'
  const [replyFocused, setReplyFocused] = useState(false);
  const [reply, setReply] = useState('');
  const [toast, setToast] = useState('');
  const [liked, setLiked] = useState({});
  const [followed, setFollowed] = useState({});
  const [videoDuration, setVideoDuration] = useState(null);

  const elapsedRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const exhaustedRef = useRef(false);
  const holdTimerRef = useRef(null);
  const suppressClickRef = useRef(false);
  const pointerStartRef = useRef(null);
  const videoRef = useRef(null);

  const group = cursor ? queue[cursor.g] : null;
  const story = currentStory(queue, cursor);
  const isInterstitial = story?.type === INTERSTITIAL;
  const isOwn = story?.author?.id === user?.id || group?.author?.id === user?.id;
  const duration =
    story?.type === 'video' && videoDuration ? videoDuration * 1000 : storyDuration(story, playback);
  const effectivelyPaused = paused || held || !!panel || replyFocused;

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(showToast.t);
    showToast.t = window.setTimeout(() => setToast(''), 2200);
  }, []);

  // --- View tracking --------------------------------------------------------
  const recordView = useCallback(
    (grp, st, completion) => {
      if (!st || st.type === INTERSTITIAL || !grp || grp.author?.id === user?.id) return;
      onSeen?.(st.id);
      api(`/stories/${st.id}/view`, {
        method: 'POST',
        body: { completion: Math.round(completion * 100) / 100, source: SOURCE_BY_KIND[grp.kind] ?? 'friends' },
      }).catch(() => {});
    },
    [onSeen, user?.id],
  );

  const fetchMore = useCallback(async () => {
    if (!loadMore || loadingMoreRef.current || exhaustedRef.current) return false;
    loadingMoreRef.current = true;
    try {
      const exclude = queue.filter((g) => g.kind === 'discover').map((g) => g.author.id);
      const { groups, hasMore } = await loadMore(exclude);
      if (!hasMore) exhaustedRef.current = true;
      if (!groups.length) return false;
      setQueue((q) => appendDiscover(q, groups));
      return true;
    } catch {
      return false;
    } finally {
      loadingMoreRef.current = false;
    }
  }, [loadMore, queue]);

  const leaveCurrent = useCallback(() => {
    const completion = duration ? Math.min(1, elapsedRef.current / duration) : 1;
    recordView(group, story, completion);
  }, [duration, group, story, recordView]);

  const goTo = useCallback(
    (target) => {
      elapsedRef.current = 0;
      setProgress(0);
      setVideoDuration(null);
      setReply('');
      setPanel(null);
      setCursor(target);
    },
    [],
  );

  const goNext = useCallback(async () => {
    if (!cursor) return;
    leaveCurrent();
    const target = nextCursor(queue, cursor);
    if (target) return goTo(target);
    const loaded = await fetchMore();
    if (loaded) return goTo({ g: cursor.g + 1, s: 0 });
    onClose?.('end');
  }, [cursor, queue, leaveCurrent, goTo, fetchMore, onClose]);

  const goPrev = useCallback(() => {
    if (!cursor) return;
    if (cursor.g === 0 && cursor.s === 0) {
      elapsedRef.current = 0;
      setProgress(0);
      return;
    }
    leaveCurrent();
    goTo(prevCursor(queue, cursor));
  }, [cursor, queue, leaveCurrent, goTo]);

  const skipGroup = useCallback(async () => {
    if (!cursor) return;
    leaveCurrent();
    const target = nextGroup(queue, cursor);
    if (target) return goTo(target);
    if (await fetchMore()) return goTo({ g: cursor.g + 1, s: 0 });
    onClose?.('end');
  }, [cursor, queue, leaveCurrent, goTo, fetchMore, onClose]);

  const close = useCallback(() => {
    leaveCurrent();
    onClose?.('closed');
  }, [leaveCurrent, onClose]);

  // --- Playback clock -------------------------------------------------------
  useEffect(() => {
    if (!story || effectivelyPaused) return undefined;
    const id = window.setInterval(() => {
      elapsedRef.current = Math.min(duration, elapsedRef.current + TICK_MS);
      setProgress(duration ? elapsedRef.current / duration : 1);
      if (elapsedRef.current >= duration) {
        window.clearInterval(id);
        if (playback.autoAdvance !== false || isInterstitial) goNext();
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [story, effectivelyPaused, duration, playback.autoAdvance, isInterstitial, goNext]);

  // Keep video element in sync with pause state.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (effectivelyPaused) v.pause?.();
    else v.play?.()?.catch?.(() => {});
  }, [effectivelyPaused, story]);

  // Prefetch more recommendations as we approach the end.
  useEffect(() => {
    if (shouldLoadMore(queue, cursor)) fetchMore();
  }, [cursor, queue, fetchMore]);

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || panel) return;
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') close();
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, close, panel]);

  useEffect(() => {
    const onVis = () => document.hidden && setPaused(true);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // --- Gestures ---------------------------------------------------------------
  const onPointerDown = (e) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    holdTimerRef.current = window.setTimeout(() => {
      setHeld(true);
      suppressClickRef.current = true;
    }, HOLD_MS);
  };
  const onPointerUp = (e) => {
    window.clearTimeout(holdTimerRef.current);
    setHeld(false);
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dy > 100 && Math.abs(dy) > Math.abs(dx)) {
      suppressClickRef.current = true;
      close();
    } else if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy)) {
      suppressClickRef.current = true;
      if (dx < 0) skipGroup();
      else if (cursor) {
        leaveCurrent();
        goTo({ g: Math.max(0, cursor.g - 1), s: 0 });
      }
    }
  };
  const tap = (direction) => () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (direction === 'next') goNext();
    else goPrev();
  };

  // --- Actions -----------------------------------------------------------------
  const toggleLike = async () => {
    const isLiked = liked[story.id] ?? story.likedByMe;
    setLiked((l) => ({ ...l, [story.id]: !isLiked }));
    try {
      await api(`/stories/${story.id}/like`, { method: isLiked ? 'DELETE' : 'POST' });
    } catch (e) {
      setLiked((l) => ({ ...l, [story.id]: isLiked }));
      showToast(e.message);
    }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    const text = reply.trim();
    if (!text) return;
    try {
      await api(`/stories/${story.id}/reply`, { method: 'POST', body: { text } });
      setReply('');
      showToast('Reply sent');
      e.target.querySelector('input')?.blur();
    } catch (err) {
      showToast(err.message);
    }
  };

  const follow = async () => {
    const author = group.author;
    try {
      const { following } = await api(`/users/${author.username}/follow`, { method: 'POST' });
      setFollowed((f) => ({ ...f, [author.id]: following }));
      showToast(following === 'pending' ? 'Follow request sent' : `Following ${author.username}`);
    } catch (e) {
      showToast(e.message);
    }
  };

  const notInterested = async () => {
    const author = group.author;
    setPanel(null);
    try {
      await api(`/users/${author.username}/not-interested`, { method: 'POST' });
      showToast("Got it — you'll see fewer stories like this");
    } catch (e) {
      showToast(e.message);
    }
    skipGroup();
  };

  const muteAuthor = async () => {
    const author = group.author;
    setPanel(null);
    try {
      await api(`/users/${author.username}/mute`, { method: 'POST' });
      showToast(`Muted ${author.username}`);
    } catch (e) {
      showToast(e.message);
    }
    skipGroup();
  };

  const deleteStory = async () => {
    if (!window.confirm('Delete this story? This cannot be undone.')) return;
    try {
      await api(`/stories/${story.id}`, { method: 'DELETE' });
      onStoryDeleted?.(story.id);
      const remaining = group.stories.filter((s) => s.id !== story.id);
      if (!remaining.length) {
        // That was your last story in this group: close, like Instagram does.
        return onClose?.('deleted');
      } else {
        setQueue((q) => q.map((g, i) => (i === cursor.g ? { ...g, stories: remaining } : g)));
        goTo({ g: cursor.g, s: Math.min(cursor.s, remaining.length - 1) });
      }
      showToast('Story deleted');
    } catch (e) {
      showToast(e.message);
    }
  };

  const openProfile = () => {
    if (!group?.author) return;
    leaveCurrent();
    onClose?.('profile');
    navigate(`/u/${group.author.username}`);
  };

  if (!story) return null;

  const isDiscover = group.kind === 'discover';
  const followState = followed[group.author?.id];
  const isLiked = liked[story.id] ?? story.likedByMe;
  const repliesAllowed = story.repliesSetting !== 'off';

  return (
    <div
      className="viewer"
      role="dialog"
      aria-label="Story viewer"
      data-testid="story-viewer"
      data-kind={group.kind}
      data-story-id={story.id}
      data-author={group.author?.username ?? ''}
      data-paused={effectivelyPaused ? 'true' : 'false'}
    >
      <div className="viewer-stage">
        {isInterstitial ? (
          <div className="interstitial" data-testid="caught-up">
            <div className="interstitial-icon" aria-hidden>✨</div>
            <h2>You're all caught up</h2>
            <p>You've seen all your friends' stories. Keep tapping to discover new creators picked for you.</p>
            <button type="button" className="btn primary" onClick={goNext}>
              Discover new creators
            </button>
            <button type="button" className="btn ghost" onClick={close}>
              Back to home
            </button>
          </div>
        ) : (
          <StoryContent
            story={story}
            muted={muted}
            dataSaver={playback.dataSaver}
            ref={videoRef}
            onVideoMeta={(d) => Number.isFinite(d) && d > 0 && setVideoDuration(Math.min(d, 60))}
          />
        )}

        {!isInterstitial && (
          <div className="tap-zones" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <button type="button" className="tap-zone left" aria-label="Previous story" onClick={tap('prev')} />
            <button type="button" className="tap-zone right" aria-label="Next story" onClick={tap('next')} />
          </div>
        )}

        <div className="viewer-top">
          <div className="progress" aria-hidden>
            {group.stories.map((s, i) => (
              <div className="progress-track" key={s.id}>
                <div
                  className="progress-fill"
                  data-testid="progress-fill"
                  style={{ transform: `scaleX(${i < cursor.s ? 1 : i === cursor.s ? progress : 0})` }}
                />
              </div>
            ))}
          </div>
          {!isInterstitial && (
            <div className="viewer-header">
              <button type="button" className="viewer-author" onClick={openProfile}>
                <Avatar user={group.author} size={32} />
                <span className="viewer-author-text">
                  <span className="viewer-username">
                    {group.kind === 'mine' ? 'Your story' : group.author.username}
                    {group.author.verified && <span className="verified" aria-label="verified">✓</span>}
                  </span>
                  <span className="viewer-meta">
                    {timeAgo(story.createdAt)}
                    {group.kind === 'highlight' && ` · ${group.title}`}
                  </span>
                </span>
              </button>
              {isDiscover && (
                <span className="for-you-chip" data-testid="for-you-chip" title={group.reasons?.join(' · ')}>
                  For You
                </span>
              )}
              {isDiscover && !followState && (
                <button type="button" className="btn small follow-btn" onClick={follow}>
                  Follow
                </button>
              )}
              {isDiscover && followState && (
                <span className="chip">{followState === 'pending' ? 'Requested' : 'Following'}</span>
              )}
              <span className="grow" />
              {story.type === 'video' && (
                <button type="button" className="icon-btn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
                  {muted ? '🔇' : '🔊'}
                </button>
              )}
              <button type="button" className="icon-btn" aria-label={paused ? 'Play' : 'Pause'} onClick={() => setPaused((p) => !p)}>
                {paused ? '▶' : '❚❚'}
              </button>
              <button type="button" className="icon-btn" aria-label="More options" onClick={() => setPanel('menu')}>
                ⋯
              </button>
              <button type="button" className="icon-btn" aria-label="Close stories" onClick={close}>
                ✕
              </button>
            </div>
          )}
          {isDiscover && group.reasons?.[0] && !isInterstitial && (
            <p className="reason" data-testid="reason">{group.reasons[0]}</p>
          )}
        </div>

        {!isInterstitial && (
          <div className="viewer-footer">
            {isOwn ? (
              <div className="own-actions">
                <button type="button" className="btn ghost" onClick={() => setPanel('viewers')}>
                  👁 {story.viewCount ?? 0} {story.viewCount === 1 ? 'view' : 'views'}
                </button>
                <button type="button" className="btn ghost" onClick={() => setPanel('highlight')}>
                  ♥ Highlight
                </button>
                <button type="button" className="btn ghost" onClick={deleteStory}>
                  🗑 Delete
                </button>
              </div>
            ) : (
              <div className="reply-bar">
                {repliesAllowed ? (
                  <form onSubmit={sendReply} className="grow">
                    <input
                      className="reply-input"
                      placeholder={`Reply to ${group.author.username}…`}
                      aria-label="Reply to story"
                      value={reply}
                      maxLength={500}
                      onChange={(e) => setReply(e.target.value)}
                      onFocus={() => setReplyFocused(true)}
                      onBlur={() => setReplyFocused(false)}
                    />
                  </form>
                ) : (
                  <span className="grow muted small-text">Replies are off</span>
                )}
                {story.likesEnabled !== false && (
                  <button
                    type="button"
                    className={`icon-btn like-btn ${isLiked ? 'liked' : ''}`}
                    aria-label={isLiked ? 'Unlike story' : 'Like story'}
                    aria-pressed={!!isLiked}
                    onClick={toggleLike}
                  >
                    {isLiked ? '♥' : '♡'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {held && <div className="hold-indicator" aria-hidden />}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>

      {panel === 'menu' && (
        <div className="sheet-backdrop" onClick={() => setPanel(null)}>
          <div className="sheet" role="menu" onClick={(e) => e.stopPropagation()}>
            {isOwn ? (
              <>
                <button type="button" role="menuitem" onClick={() => setPanel('highlight')}>Add to highlight</button>
                <button type="button" role="menuitem" onClick={() => setPanel('viewers')}>View insights</button>
                <button type="button" role="menuitem" className="danger" onClick={deleteStory}>Delete story</button>
              </>
            ) : (
              <>
                <button type="button" role="menuitem" onClick={openProfile}>View profile</button>
                {isDiscover && (
                  <button type="button" role="menuitem" onClick={notInterested}>Not interested</button>
                )}
                <button type="button" role="menuitem" onClick={muteAuthor}>Mute {group.author.username}</button>
              </>
            )}
            <button type="button" role="menuitem" onClick={() => setPanel(null)}>Cancel</button>
          </div>
        </div>
      )}
      {panel === 'highlight' && (
        <HighlightPicker storyIds={[story.id]} onClose={() => setPanel(null)} onSaved={(_h, msg) => showToast(msg)} />
      )}
      {panel === 'viewers' && <ViewersSheet storyId={story.id} onClose={() => setPanel(null)} />}
    </div>
  );
}
