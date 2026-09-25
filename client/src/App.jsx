import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { registerBackButton } from './lib/native.js';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import BottomNav from './components/BottomNav.jsx';
import Activity from './pages/Activity.jsx';
import Archive from './pages/Archive.jsx';
import Create from './pages/Create.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Conversation from './pages/Conversation.jsx';
import Home from './pages/Home.jsx';
import Legal from './pages/Legal.jsx';
import Moderation from './pages/Moderation.jsx';
import TermsGate from './components/TermsGate.jsx';
import Messages from './pages/Messages.jsx';
import Login from './pages/Login.jsx';
import Profile from './pages/Profile.jsx';
import Search from './pages/Search.jsx';
import Settings from './pages/Settings.jsx';
import Signup from './pages/Signup.jsx';

function useUnreadCount(user) {
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  useEffect(() => {
    if (!user) return;
    api('/notifications')
      .then((d) => setUnread(d.unread))
      .catch(() => {});
  }, [user, location.pathname]);
  return unread;
}

const LEGAL_PATHS = ['/privacy', '/terms', '/guidelines', '/delete-account'];

export default function App() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let cleanup = () => {};
    registerBackButton(navigate).then((fn) => (cleanup = fn));
    return () => cleanup();
  }, [navigate]);
  const unread = useUnreadCount(user);

  if (loading) return <div className="splash">Storytime</div>;

  const legalRoutes = ['privacy', 'terms', 'guidelines', 'delete-account'].map((doc) => (
    <Route key={doc} path={`/${doc}`} element={<Legal doc={doc} />} />
  ));

  if (!user) {
    return (
      <Routes>
        {legalRoutes}
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/create" element={<Create />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/edit-profile" element={<EditProfile />} />
          <Route path="/u/:username" element={<Profile />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:username" element={<Conversation />} />
          <Route path="/moderation" element={<Moderation />} />
          {legalRoutes}
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/signup" element={<Navigate to="/" replace />} />
          <Route path="*" element={<div className="page"><p className="muted center">Page not found.</p></div>} />
        </Routes>
      </main>
      <BottomNav unread={unread} />
      {user.needsTermsAcceptance && !LEGAL_PATHS.includes(pathname) && <TermsGate />}
    </div>
  );
}
