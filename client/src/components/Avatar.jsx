export default function Avatar({ user, size = 40, ring = null, onClick, className = '' }) {
  const initials = (user?.displayName || user?.username || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const inner = user?.avatarUrl ? (
    <img src={user.avatarUrl} alt={`${user.username}'s profile picture`} className="avatar-img" draggable="false" />
  ) : (
    <span className="avatar-fallback" aria-label={`${user?.username ?? 'user'}'s profile picture`}>
      {initials}
    </span>
  );
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`avatar ${ring ? `ring-${ring}` : ''} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      onClick={onClick}
      data-ring={ring ?? 'none'}
    >
      {inner}
    </Tag>
  );
}
