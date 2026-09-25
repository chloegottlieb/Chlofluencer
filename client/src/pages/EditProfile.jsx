import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Avatar from '../components/Avatar.jsx';
import { INTEREST_OPTIONS } from './Signup.jsx';

const BIO_MAX = 150;

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    displayName: user.displayName ?? '',
    bio: user.bio ?? '',
    website: user.website ?? '',
  });
  const [interests, setInterests] = useState(user.interests ?? []);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const toggleInterest = (tag) =>
    setInterests((list) => (list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]));

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.append('avatar', file);
    setError('');
    try {
      const { user: updated } = await api('/users/me/avatar', { method: 'POST', form: data });
      setUser(updated);
      setStatus('Profile picture updated');
    } catch (err) {
      setError(err.message);
    }
  };

  const removeAvatar = async () => {
    const { user: updated } = await api('/users/me/avatar', { method: 'DELETE' });
    setUser(updated);
    setStatus('Profile picture removed');
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user: updated } = await api('/users/me', { method: 'PATCH', body: { ...form, interests } });
      setUser(updated);
      navigate(`/u/${updated.username}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const allInterests = [...new Set([...INTEREST_OPTIONS, ...interests])];

  return (
    <div className="page">
      <header className="top-bar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}>‹</button>
        <h1>Edit profile</h1>
        <span />
      </header>
      <div className="avatar-edit">
        <Avatar user={user} size={96} />
        <label className="link-btn">
          Change profile picture
          <input type="file" accept="image/*" hidden aria-label="Upload profile picture" onChange={uploadAvatar} />
        </label>
        {user.avatarUrl && (
          <button type="button" className="link-btn danger" onClick={removeAvatar}>
            Remove current picture
          </button>
        )}
      </div>
      {status && <p className="form-success" role="status">{status}</p>}
      <form onSubmit={submit} className="stack">
        <label>
          <span>Name</span>
          <input name="displayName" value={form.displayName} maxLength={50} onChange={set('displayName')} />
        </label>
        <label>
          <span>Bio</span>
          <textarea name="bio" aria-label="Bio" rows={3} value={form.bio} onChange={set('bio')} />
          <span className={`counter ${form.bio.length > BIO_MAX ? 'over' : ''}`}>
            {form.bio.length}/{BIO_MAX}
          </span>
        </label>
        <label>
          <span>Website</span>
          <input name="website" type="url" placeholder="https://" value={form.website} onChange={set('website')} />
        </label>
        <fieldset className="interests">
          <legend>Interests</legend>
          <div className="chips">
            {allInterests.map((tag) => (
              <button
                type="button"
                key={tag}
                className={`chip selectable ${interests.includes(tag) ? 'selected' : ''}`}
                aria-pressed={interests.includes(tag)}
                onClick={() => toggleInterest(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  );
}
