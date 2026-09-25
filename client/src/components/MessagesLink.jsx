import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';

const POLL_MS = 15_000;

/** Paper-plane link to the DM inbox with an unread badge. */
export default function MessagesLink() {
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  useEffect(() => {
    let alive = true;
    const load = () =>
      api('/messages/unread')
        .then((d) => alive && setUnread(d.unread ?? 0))
        .catch(() => {});
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [location.pathname]);
  return (
    <Link to="/messages" className="icon-btn with-badge" aria-label={unread ? `Messages, ${unread} unread` : 'Messages'}>
      <span aria-hidden>✈</span>
      {unread > 0 && <span className="badge" data-testid="dm-badge">{unread > 9 ? '9+' : unread}</span>}
    </Link>
  );
}
