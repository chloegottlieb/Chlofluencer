import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Toggle from '../components/Toggle.jsx';

export const BACKGROUNDS = [
  'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)',
  'linear-gradient(135deg, #00c6ff, #0072ff)',
  'linear-gradient(135deg, #11998e, #38ef7d)',
  'linear-gradient(135deg, #fc5c7d, #6a82fb)',
  'linear-gradient(135deg, #f7971e, #ffd200)',
  '#111111',
];

export default function Create() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('text');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [durationMs, setDurationMs] = useState(null);
  const [text, setText] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [audience, setAudience] = useState(user.settings?.stories?.defaultAudience ?? 'public');
  const [allowDiscovery, setAllowDiscovery] = useState(user.settings?.discovery?.appearInDiscover !== false);
  const [sensitive, setSensitive] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isVideo = file?.type?.startsWith('video/');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'media' && !file) return setError('Choose a photo or video first');
    if (mode === 'text' && !text.trim()) return setError('Write something for your story');
    const form = new FormData();
    if (mode === 'media') {
      form.append('media', file);
      if (durationMs) form.append('durationMs', String(durationMs));
    } else {
      form.append('text', text);
      form.append('background', background);
    }
    form.append('caption', caption);
    form.append('tags', tags);
    form.append('audience', audience);
    form.append('allowDiscovery', String(audience === 'public' && allowDiscovery));
    form.append('sensitive', String(sensitive));
    setBusy(true);
    try {
      await api('/stories', { method: 'POST', form });
      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="top-bar">
        <h1>New story</h1>
      </header>
      <form onSubmit={submit} className="create-form">
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'text'} className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>
            Aa Text
          </button>
          <button type="button" role="tab" aria-selected={mode === 'media'} className={mode === 'media' ? 'active' : ''} onClick={() => setMode('media')}>
            📷 Photo / Video
          </button>
        </div>

        <div className="story-preview" style={{ background: mode === 'text' ? background : '#000' }} data-testid="story-preview">
          {mode === 'text' ? (
            <textarea
              aria-label="Story text"
              placeholder="Type something…"
              value={text}
              maxLength={280}
              onChange={(e) => setText(e.target.value)}
            />
          ) : preview ? (
            isVideo ? (
              <video
                src={preview}
                controls
                muted
                onLoadedMetadata={(e) => setDurationMs(Math.round(Math.min(60, e.currentTarget.duration) * 1000))}
              />
            ) : (
              <img src={preview} alt="Story preview" />
            )
          ) : (
            <label className="file-drop">
              <span>Tap to choose a photo or video</span>
              <input
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime"
                aria-label="Choose photo or video"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>
        {mode === 'media' && file && (
          <button type="button" className="link-btn" onClick={() => setFile(null)}>
            Choose a different file
          </button>
        )}

        {mode === 'text' && (
          <div className="swatches" role="radiogroup" aria-label="Background">
            {BACKGROUNDS.map((bg, i) => (
              <button
                type="button"
                key={bg}
                role="radio"
                aria-checked={background === bg}
                aria-label={`Background ${i + 1}`}
                className={`swatch ${background === bg ? 'selected' : ''}`}
                style={{ background: bg }}
                onClick={() => setBackground(bg)}
              />
            ))}
          </div>
        )}

        <label>
          <span>Caption</span>
          <input name="caption" value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} />
        </label>
        <label>
          <span>Tags (help the right people discover you)</span>
          <input name="tags" placeholder="#travel #vlog" value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <label>
          <span>Who can see this?</span>
          <select name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="public">Everyone</option>
            <option value="followers">Followers only</option>
          </select>
        </label>
        <Toggle
          label="Show in For You"
          description="Let people who don't follow you discover this story"
          checked={audience === 'public' && allowDiscovery}
          disabled={audience !== 'public'}
          onChange={setAllowDiscovery}
        />
        <Toggle
          label="Sensitive content"
          description="Hidden from people who filter sensitive content"
          checked={sensitive}
          onChange={setSensitive}
        />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? 'Sharing…' : 'Share to your story'}
        </button>
      </form>
    </div>
  );
}
