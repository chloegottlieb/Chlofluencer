import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Avatar from './Avatar.jsx';

export default function BottomNav({ unread = 0 }) {
  const { user } = useAuth();
  return (
    <nav className="bottom-nav" aria-label="Main">
      <NavLink to="/" end aria-label="Home">
        <span aria-hidden>⌂</span>
      </NavLink>
      <NavLink to="/search" aria-label="Search">
        <span aria-hidden>⌕</span>
      </NavLink>
      <NavLink to="/create" aria-label="New story" className="nav-create">
        <span aria-hidden>＋</span>
      </NavLink>
      <NavLink to="/activity" aria-label="Activity">
        <span aria-hidden>♡</span>
        {unread > 0 && <span className="badge" data-testid="unread-badge">{unread > 9 ? '9+' : unread}</span>}
      </NavLink>
      <NavLink to={`/u/${user?.username}`} aria-label="Profile">
        <Avatar user={user} size={26} />
      </NavLink>
    </nav>
  );
}
