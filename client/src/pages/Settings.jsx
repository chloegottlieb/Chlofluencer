import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Avatar from '../components/Avatar.jsx';
import Toggle from '../components/Toggle.jsx';

/** Labels for every setting, grouped the way they appear on screen. */
export const SETTINGS_SECTIONS = [
  {
    group: 'privacy',
    title: 'Privacy',
    fields: {
      privateAccount: ['Private account', 'Only approved followers can see your stories and highlights. Private accounts never appear in For You.'],
      storyReplies: ['Allow story replies from', null, { everyone: 'Everyone', following: 'People you follow', off: 'Off' }],
      showActivityStatus: ['Show activity status', 'Let people see when you were last active'],
      showViewCounts: ['Show view & like counts', 'Let viewers see how many views and likes your stories have'],
    },
  },
  {
    group: 'discovery',
    title: 'For You & discovery',
    fields: {
      showDiscover: ['Discover new creators', "Keep tapping into recommended stories from people you don't follow after your friends' stories end"],
      appearInDiscover: ['Recommend my stories', "Let your public stories appear in strangers' For You"],
      personalized: ['Personalized recommendations', 'Use your interests, likes and watch time to rank For You. Off shows trending stories instead.'],
      hideSensitive: ['Filter sensitive content', 'Hide stories creators marked as sensitive'],
    },
  },
  {
    group: 'stories',
    title: 'Your stories',
    fields: {
      defaultAudience: ['Default audience', null, { public: 'Everyone', followers: 'Followers only' }],
      saveToArchive: ['Save stories to archive', 'Keep a private copy after 24 hours so you can add them to highlights later'],
      allowLikes: ['Allow likes', 'Let viewers like your stories'],
    },
  },
  {
    group: 'playback',
    title: 'Playback',
    fields: {
      autoAdvance: ['Auto-advance', 'Automatically move to the next story when one ends'],
      imageDurationSec: ['Photo story duration', null, { 3: '3 seconds', 5: '5 seconds', 7: '7 seconds', 10: '10 seconds', 15: '15 seconds' }],
      muteByDefault: ['Start videos muted', null],
      dataSaver: ['Data saver', "Don't preload videos on cellular data"],
    },
  },
  {
    group: 'notifications',
    title: 'Notifications',
    fields: {
      pauseAll: ['Pause all', 'Temporarily stop all notifications'],
      likes: ['Story likes', null],
      replies: ['Story replies', null],
      follows: ['New followers', null],
      followRequests: ['Follow requests', null],
    },
  },
  {
    group: 'appearance',
    title: 'Appearance',
    fields: {
      theme: ['Theme', null, { dark: 'Dark', light: 'Light', system: 'Match system' }],
      reduceMotion: ['Reduce motion', 'Minimise animations'],
    },
  },
];

function AccountList({ title, path, action, actionLabel }) {
  const [users, setUsers] = useState(null);
  useEffect(() => {
    api(`/users/me/${path}`).then((d) => setUsers(d.users));
  }, [path]);
  const undo = async (u) => {
    await api(`/users/${u.username}/${action}`, { method: 'DELETE' });
    setUsers((list) => list.filter((x) => x.id !== u.id));
  };
  return (
    <details className="settings-details">
      <summary>
        {title} {users && <span className="muted">({users.length})</span>}
      </summary>
      {users?.length === 0 && <p className="muted small-text">None</p>}
      <ul className="list">
        {users?.map((u) => (
          <li key={u.id} className="list-row">
            <Avatar user={u} size={32} />
            <Link to={`/u/${u.username}`} className="grow">{u.username}</Link>
            <button type="button" className="btn small" onClick={() => undo(u)}>{actionLabel}</button>
          </li>
        ))}
      </ul>
    </details>
  );
}

const REPORT_STATUS = { open: 'In review', actioned: 'Action taken', dismissed: 'No violation found' };

function MyReports() {
  const [reports, setReports] = useState(null);
  useEffect(() => {
    api('/reports/mine').then((d) => setReports(d.reports)).catch(() => setReports([]));
  }, []);
  return (
    <details className="settings-details">
      <summary>Your reports {reports && <span className="muted">({reports.length})</span>}</summary>
      {reports?.length === 0 && <p className="muted small-text">You haven't reported anything.</p>}
      <ul className="list">
        {reports?.map((r) => (
          <li key={r.id} className="list-row small-text">
            <span className="grow">{r.targetType} · {r.reason.replace('_', ' ')}</span>
            <span className="muted">{REPORT_STATUS[r.status]}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function Settings() {
  const { user, setUser, logout, setToken } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(user.settings);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [deletePw, setDeletePw] = useState('');
  const [supportEmail, setSupportEmail] = useState('');

  useEffect(() => {
    api('/config').then((d) => setSupportEmail(d.supportEmail)).catch(() => {});
  }, []);

  const flash = (msg) => {
    setStatus(msg);
    setError('');
    window.clearTimeout(flash.t);
    flash.t = window.setTimeout(() => setStatus(''), 2000);
  };

  const update = async (group, key, value) => {
    const previous = settings;
    const optimistic = { ...settings, [group]: { ...settings[group], [key]: value } };
    setSettings(optimistic);
    try {
      const { settings: saved } = await api('/settings', { method: 'PATCH', body: { [group]: { [key]: value } } });
      setSettings(saved);
      setUser({ ...user, settings: saved });
      flash('Saved');
    } catch (e) {
      setSettings(previous);
      setError(e.message);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      const { token } = await api('/settings/password', { method: 'POST', body: pw });
      setToken(token);
      setPw({ currentPassword: '', newPassword: '' });
      flash('Password changed. Other devices were logged out.');
    } catch (err) {
      setError(err.message);
    }
  };

  const resetRecs = async () => {
    await api('/settings/reset-recommendations', { method: 'POST' });
    flash('For You recommendations reset');
  };

  const logoutEverywhere = async () => {
    await api('/auth/logout-everywhere', { method: 'POST' });
    logout();
    navigate('/login');
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    if (!window.confirm('Permanently delete your account, stories and highlights?')) return;
    try {
      await api('/users/me', { method: 'DELETE', body: { password: deletePw } });
      logout();
      navigate('/signup');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page settings">
      <header className="top-bar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}>‹</button>
        <h1>Settings</h1>
        <span />
      </header>
      {status && <p className="form-success sticky" role="status">{status}</p>}
      {error && <p className="form-error sticky" role="alert">{error}</p>}

      <section className="settings-section">
        <h2>Account</h2>
        <Link className="setting-link" to="/edit-profile">Edit profile, photo & bio</Link>
        <Link className="setting-link" to="/archive">Story archive & highlights</Link>
        <Link className="setting-link" to="/activity">Follow requests & activity</Link>
      </section>

      {SETTINGS_SECTIONS.map(({ group, title, fields }) => (
        <section className="settings-section" key={group} aria-label={title}>
          <h2>{title}</h2>
          {Object.entries(fields).map(([key, [label, description, options]]) =>
            options ? (
              <label className="setting-row" key={key}>
                <span className="setting-text">
                  <span className="setting-label">{label}</span>
                  {description && <span className="setting-desc">{description}</span>}
                </span>
                <select
                  aria-label={label}
                  value={String(settings[group][key])}
                  onChange={(e) => {
                    const raw = e.target.value;
                    update(group, key, typeof settings[group][key] === 'number' ? Number(raw) : raw);
                  }}
                >
                  {Object.entries(options).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </label>
            ) : (
              <Toggle
                key={key}
                name={`${group}.${key}`}
                label={label}
                description={description}
                checked={settings[group][key]}
                onChange={(v) => update(group, key, v)}
                disabled={group === 'notifications' && key !== 'pauseAll' && settings.notifications.pauseAll}
              />
            ),
          )}
          {group === 'discovery' && (
            <button type="button" className="btn small" onClick={resetRecs}>
              Reset For You recommendations
            </button>
          )}
        </section>
      ))}

      <section className="settings-section" aria-label="Help & safety">
        <h2>Help & safety</h2>
        {user.isModerator && <Link className="setting-link" to="/moderation">🛡 Moderation queue</Link>}
        <Link className="setting-link" to="/guidelines">Community Guidelines</Link>
        <Link className="setting-link" to="/terms">Terms of Use</Link>
        <Link className="setting-link" to="/privacy">Privacy Policy</Link>
        <MyReports />
        <p className="muted small-text">
          Need help or want to appeal a decision? Email{' '}
          {supportEmail ? <a href={`mailto:${supportEmail}`}>{supportEmail}</a> : 'our support team'}. To report a story, account
          or message, use the ⋯ menu on it.
        </p>
      </section>

      <section className="settings-section">
        <h2>Blocked & hidden accounts</h2>
        <AccountList title="Blocked accounts" path="blocked" action="block" actionLabel="Unblock" />
        <AccountList title="Muted accounts" path="muted" action="mute" actionLabel="Unmute" />
        <AccountList title="Hidden from For You" path="not-interested" action="not-interested" actionLabel="Show again" />
      </section>

      <section className="settings-section">
        <h2>Security</h2>
        <form onSubmit={changePassword} className="stack">
          <input
            type="password"
            aria-label="Current password"
            placeholder="Current password"
            autoComplete="current-password"
            value={pw.currentPassword}
            onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
          />
          <input
            type="password"
            aria-label="New password"
            placeholder="New password"
            autoComplete="new-password"
            value={pw.newPassword}
            onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
          />
          <button type="submit" className="btn" disabled={!pw.currentPassword || !pw.newPassword}>
            Change password
          </button>
        </form>
        <button type="button" className="btn block" onClick={logoutEverywhere}>Log out of all devices</button>
      </section>

      <section className="settings-section">
        <button type="button" className="btn block" onClick={() => { logout(); navigate('/login'); }}>
          Log out
        </button>
        <details className="settings-details danger-zone">
          <summary>Delete account</summary>
          <form onSubmit={deleteAccount} className="stack">
            <p className="muted small-text">This permanently deletes your profile, stories, highlights and followers.</p>
            <input
              type="password"
              aria-label="Confirm password to delete account"
              placeholder="Password"
              value={deletePw}
              onChange={(e) => setDeletePw(e.target.value)}
            />
            <button type="submit" className="btn danger" disabled={!deletePw}>Delete my account</button>
          </form>
        </details>
      </section>
      <p className="muted center small-text">Signed in as @{user.username}</p>
    </div>
  );
}
