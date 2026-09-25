import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from './auth.js';
import { defaultSettings } from './lib/settings.js';
import { newId } from './lib/social.js';
import { STORY_TTL_MS } from './lib/feed.js';

export const DEMO_PASSWORD = 'password123';
const HOUR = 60 * 60 * 1000;

const GRADIENTS = [
  ['#833ab4', '#fd1d1d', '#fcb045'],
  ['#00c6ff', '#0072ff'],
  ['#f7971e', '#ffd200'],
  ['#11998e', '#38ef7d'],
  ['#fc5c7d', '#6a82fb'],
  ['#e96443', '#904e95'],
  ['#1d2b64', '#f8cdda'],
  ['#232526', '#414345'],
];

const cssGradient = (colors) => `linear-gradient(160deg, ${colors.join(', ')})`;

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
}

/** Generates a vertical 9:16 illustrated "photo" so the demo works offline. */
export function storySvg({ emoji, title, subtitle = '', colors }) {
  const stops = colors.map((c, i) => `<stop offset="${(i / (colors.length - 1)) * 100}%" stop-color="${c}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs>
  <rect width="1080" height="1920" fill="url(#g)"/>
  <circle cx="860" cy="360" r="260" fill="#ffffff" opacity="0.08"/>
  <circle cx="160" cy="1500" r="340" fill="#000000" opacity="0.08"/>
  <text x="540" y="900" font-size="360" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  <text x="540" y="1250" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="88" fill="#fff" text-anchor="middle">${escapeXml(title)}</text>
  <text x="540" y="1360" font-family="Helvetica, Arial, sans-serif" font-size="52" fill="#ffffffcc" text-anchor="middle">${escapeXml(subtitle)}</text>
</svg>`;
}

export function avatarSvg({ initials, colors }) {
  const stops = colors.map((c, i) => `<stop offset="${(i / (colors.length - 1)) * 100}%" stop-color="${c}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs>
  <rect width="320" height="320" fill="url(#g)"/>
  <text x="160" y="175" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="130" fill="#fff" text-anchor="middle" dominant-baseline="middle">${escapeXml(initials)}</text>
</svg>`;
}

// username, name, bio, interests, private?, stories: [hoursAgo, kind, payload, tags]
const PEOPLE = [
  { username: 'demo', name: 'Demo User', bio: 'Just here to watch stories 👀', interests: ['travel', 'food', 'fitness'], stories: [] },
  {
    username: 'maya.travels', name: 'Maya Chen', bio: '✈️ 42 countries & counting | vlogging my way around the world', interests: ['travel', 'vlog'], verified: true,
    stories: [
      [20, 'image', { emoji: '🌅', title: 'Sunrise in Bali', subtitle: '5am wake up was worth it' }, ['travel', 'bali', 'vlog']],
      [6, 'image', { emoji: '🛵', title: 'Scooter day', subtitle: 'Ubud → Canggu' }, ['travel', 'vlog']],
      [1, 'text', 'Q&A tonight! Drop your travel questions 💬', ['travel', 'qanda']],
    ],
  },
  {
    username: 'leo.lifts', name: 'Leo Martins', bio: 'Coach. 5am club. Progress > perfection 💪', interests: ['fitness', 'health'],
    stories: [
      [10, 'image', { emoji: '🏋️', title: 'Leg day', subtitle: 'New PR: 180kg squat' }, ['fitness', 'gym']],
      [3, 'text', 'Hydration check 💧 Have you had water today?', ['fitness', 'health']],
    ],
  },
  {
    username: 'priya.cooks', name: 'Priya Patel', bio: 'Home cook sharing 15-min recipes 🍛', interests: ['food', 'recipes'],
    stories: [[4, 'image', { emoji: '🍛', title: 'Butter chickpea curry', subtitle: 'Recipe in highlights' }, ['food', 'recipes', 'vegan']]],
  },
  {
    username: 'jordan.codes', name: 'Jordan Lee', bio: 'Building in public 🧑‍💻 indie hacker', interests: ['tech', 'startups'],
    stories: [
      [8, 'text', 'Shipped v2 of my app today 🚀 247 signups in 3 hours', ['tech', 'startups']],
      [2, 'image', { emoji: '💻', title: 'Desk setup tour', subtitle: 'Swipe for links' }, ['tech', 'setup']],
    ],
  },
  {
    username: 'sofia.style', name: 'Sofia Rossi', bio: 'Thrifted fits & slow fashion 🧵', interests: ['fashion', 'thrift'], verified: true,
    stories: [
      [12, 'image', { emoji: '👗', title: 'OOTD', subtitle: 'All thrifted, under $40' }, ['fashion', 'thrift']],
      [5, 'image', { emoji: '🧥', title: 'Fall capsule', subtitle: '10 pieces, 30 outfits' }, ['fashion']],
    ],
  },
  {
    username: 'kai.beats', name: 'Kai Nakamura', bio: 'Lo-fi producer 🎧 new beat every Friday', interests: ['music', 'lofi'],
    stories: [[7, 'image', { emoji: '🎧', title: 'Studio session', subtitle: 'Snippet drops Friday' }, ['music', 'lofi']]],
  },
  {
    username: 'zoe.wanders', name: 'Zoë Laurent', bio: 'Van life across Europe 🚐', interests: ['travel', 'vanlife'],
    stories: [
      [9, 'image', { emoji: '🏔️', title: 'Dolomites', subtitle: 'Camped at 2,000m' }, ['travel', 'vanlife', 'hiking']],
      [0.5, 'text', 'Which country next? 🇵🇹 or 🇪🇸', ['travel', 'vanlife']],
    ],
  },
  {
    username: 'noor.eats', name: 'Noor Haddad', bio: 'Street food hunter 🌯', interests: ['food', 'streetfood'],
    stories: [[11, 'image', { emoji: '🌯', title: 'Best shawarma in town', subtitle: '$6 and life-changing' }, ['food', 'streetfood']]],
  },
  {
    username: 'omar.laughs', name: 'Omar Farouk', bio: 'Stand-up comic. Touring now 🎤', interests: ['comedy'],
    stories: [[13, 'text', 'Me explaining to my mom that "content creator" is a real job 😂', ['comedy']]],
  },
  {
    username: 'ana.paints', name: 'Ana Souza', bio: 'Watercolor & ink 🎨 commissions open', interests: ['art', 'painting'],
    stories: [[15, 'image', { emoji: '🎨', title: 'Work in progress', subtitle: 'Day 3 of 5' }, ['art', 'painting']]],
  },
  {
    username: 'sam.private', name: 'Sam Private', bio: 'Close friends only 🔒', interests: ['travel'], private: true,
    stories: [[2, 'text', 'This is a private story', ['travel']]],
  },
];

const FRIENDS_OF_DEMO = ['maya.travels', 'leo.lifts', 'priya.cooks'];

/** Populate an empty database with demo creators, stories and highlights. */
export function seedDemoData(db, { now = Date.now(), uploadDir }) {
  fs.mkdirSync(uploadDir, { recursive: true });
  const passwordHash = hashPassword(DEMO_PASSWORD);
  const users = {};
  let g = 0;

  const writeSvg = (name, svg) => {
    fs.writeFileSync(path.join(uploadDir, name), svg);
    return `/uploads/${name}`;
  };

  PEOPLE.forEach((p, idx) => {
    const colors = GRADIENTS[idx % GRADIENTS.length];
    const initials = p.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const user = db.insert('users', {
      id: newId(),
      username: p.username,
      email: `${p.username.replace('.', '_')}@example.com`,
      passwordHash,
      displayName: p.name,
      bio: p.bio,
      website: '',
      avatarUrl: p.username === 'demo' ? null : writeSvg(`seed-avatar-${p.username}.svg`, avatarSvg({ initials, colors })),
      interests: p.interests,
      verified: !!p.verified,
      tokenVersion: 0,
      createdAt: now - (idx < 6 ? 400 : 5) * 24 * HOUR,
    });
    const settings = defaultSettings();
    if (p.private) settings.privacy.privateAccount = true;
    db.insert('settings', { userId: user.id, values: settings });
    users[p.username] = user;

    p.stories.forEach(([hoursAgo, kind, payload, tags], sIdx) => {
      const createdAt = now - hoursAgo * HOUR;
      const c = GRADIENTS[g++ % GRADIENTS.length];
      db.insert('stories', {
        id: newId(),
        authorId: user.id,
        type: kind,
        mediaUrl: kind === 'image' ? writeSvg(`seed-story-${p.username}-${sIdx}.svg`, storySvg({ ...payload, colors: c })) : null,
        text: kind === 'text' ? payload : '',
        background: cssGradient(c),
        caption: '',
        tags,
        audience: 'public',
        allowDiscovery: true,
        sensitive: false,
        durationMs: null,
        createdAt,
        expiresAt: createdAt + STORY_TTL_MS,
      });
    });
  });

  for (const friend of FRIENDS_OF_DEMO) {
    db.insert('follows', { followerId: users.demo.id, followeeId: users[friend].id, status: 'accepted', createdAt: now - 30 * 24 * HOUR });
    db.insert('follows', { followerId: users[friend].id, followeeId: users.demo.id, status: 'accepted', createdAt: now - 30 * 24 * HOUR });
  }
  db.insert('follows', { followerId: users['maya.travels'].id, followeeId: users['zoe.wanders'].id, status: 'accepted', createdAt: now - 10 * 24 * HOUR });

  // Some engagement so "Trending" means something.
  const fans = Object.values(users).filter((u) => u.username !== 'demo');
  const popular = db.filter('stories', (s) => [users['sofia.style'].id, users['zoe.wanders'].id].includes(s.authorId));
  for (const story of popular) {
    for (const fan of fans) {
      if (fan.id === story.authorId) continue;
      db.insert('views', { storyId: story.id, viewerId: fan.id, completion: 1, source: 'discover', viewedAt: story.createdAt + HOUR / 2 });
      db.insert('likes', { storyId: story.id, userId: fan.id, createdAt: story.createdAt + HOUR / 2 });
    }
  }

  // Older, expired stories for Maya that live on in a highlight, plus one in demo's archive.
  const old = [
    { emoji: '🗼', title: 'Paris', subtitle: 'Spring 2026' },
    { emoji: '🏯', title: 'Kyoto', subtitle: 'Cherry blossom season' },
    { emoji: '🏜️', title: 'Wadi Rum', subtitle: 'Slept under the stars' },
  ].map((payload, i) => {
    const createdAt = now - (60 + i * 24) * 24 * HOUR;
    const c = GRADIENTS[(i + 3) % GRADIENTS.length];
    return db.insert('stories', {
      id: newId(),
      authorId: users['maya.travels'].id,
      type: 'image',
      mediaUrl: writeSvg(`seed-highlight-maya-${i}.svg`, storySvg({ ...payload, colors: c })),
      text: '',
      background: cssGradient(c),
      caption: payload.subtitle,
      tags: ['travel'],
      audience: 'public',
      allowDiscovery: true,
      sensitive: false,
      durationMs: null,
      createdAt,
      expiresAt: createdAt + STORY_TTL_MS,
    });
  });
  db.insert('highlights', {
    id: newId(),
    ownerId: users['maya.travels'].id,
    title: 'Best trips',
    storyIds: old.map((s) => s.id),
    coverStoryId: old[1].id,
    createdAt: now - 20 * 24 * HOUR,
    updatedAt: now - 20 * 24 * HOUR,
  });

  const demoOld = now - 3 * 24 * HOUR;
  db.insert('stories', {
    id: newId(),
    authorId: users.demo.id,
    type: 'text',
    mediaUrl: null,
    text: 'My very first story on Chlofluencer ✨',
    background: cssGradient(GRADIENTS[4]),
    caption: '',
    tags: ['firstpost'],
    audience: 'public',
    allowDiscovery: true,
    sensitive: false,
    durationMs: null,
    createdAt: demoOld,
    expiresAt: demoOld + STORY_TTL_MS,
  });

  return users;
}
