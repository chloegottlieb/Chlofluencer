import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export const INTEREST_OPTIONS = [
  'travel', 'food', 'fitness', 'fashion', 'beauty', 'music', 'tech', 'art',
  'comedy', 'gaming', 'sports', 'books', 'pets', 'diy', 'vlog', 'startups',
];

export default function Signup() {
  const { signup } = useAuth();
  const [form, setForm] = useState({ username: '', displayName: '', email: '', password: '' });
  const [interests, setInterests] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const toggleInterest = (tag) =>
    setInterests((list) => (list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signup({ ...form, interests });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1 className="logo big">Chlofluencer</h1>
        <p className="muted center">Sign up to share stories and discover creators.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <label>
          <span>Username</span>
          <input name="username" autoComplete="username" value={form.username} onChange={set('username')} required />
        </label>
        <label>
          <span>Name</span>
          <input name="displayName" autoComplete="name" value={form.displayName} onChange={set('displayName')} />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required />
        </label>
        <fieldset className="interests">
          <legend>What are you into? (shapes your For You stories)</legend>
          <div className="chips">
            {INTEREST_OPTIONS.map((tag) => (
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
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
        <p className="center">
          Have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
