import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api.js';
import Avatar from '../components/Avatar.jsx';

export default function Search() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return undefined;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api(`/users/search${qs({ q })}`, { signal: ctrl.signal })
        .then((d) => setResults(d.users))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div className="page">
      <header className="top-bar">
        <input
          className="search-input"
          type="search"
          placeholder="Search creators"
          aria-label="Search creators"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </header>
      <ul className="list">
        {results.map((u) => (
          <li key={u.id} className="list-row">
            <Avatar user={u} size={44} />
            <Link to={`/u/${u.username}`} className="grow">
              <strong>{u.username}</strong>
              {u.verified && <span className="verified">✓</span>}
              <br />
              <span className="muted">{u.displayName}</span>
            </Link>
          </li>
        ))}
      </ul>
      {q && results.length === 0 && <p className="muted center">No results for “{q}”.</p>}
    </div>
  );
}
