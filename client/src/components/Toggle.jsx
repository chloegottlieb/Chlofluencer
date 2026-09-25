export default function Toggle({ label, description, checked, onChange, disabled, name }) {
  return (
    <label className="setting-row">
      <span className="setting-text">
        <span className="setting-label">{label}</span>
        {description && <span className="setting-desc">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        name={name}
        aria-label={label}
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
