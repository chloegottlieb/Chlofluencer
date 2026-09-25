import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import BottomNav from './components/BottomNav.jsx';
import Activity from './pages/Activity.jsx';
import Archive from './pages/Archive.jsx';
import Create from './pages/Create.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Conversation from './pages/Conversation.jsx';
import Home from './pages/Home.jsx';
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

export default function App() {
  const { user, loading } = useAuth();
  const unread = useUnreadCount(user);

  if (loading) return <div className="splash">Storytime</div>;

  if (!user) {
    return (
      <Routes>
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
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/signup" element={<Navigate to="/" replace />} />
          <Route path="*" element={<div className="page"><p className="muted center">Page not found.</p></div>} />
        </Routes>
      </main>
      <BottomNav unread={unread} />
    </div>
  );
}
