# Deploying the Storytime backend

The native apps need a server on the internet. Storytime's backend is a single Node.js service that:

- serves the API (`/api/...`), uploaded media (`/uploads/...`) and the web version of the app;
- stores everything in **SQLite** (`storytime.sqlite`) plus a media folder, both on one persistent disk;
- is packaged as a **Docker image** (see `Dockerfile`).

Recommended host: **[Fly.io](https://fly.io)**. It runs one always-on machine with a persistent volume, costs a few dollars a month, and gives you HTTPS. A [Render](#alternative-render) option is below.

> **Why one server?** SQLite lives on a single disk, so run exactly one instance, which the provided `fly.toml` does. That comfortably serves thousands of users. When you outgrow it, move to Postgres and object storage (see [Scaling later](#scaling-later)).

---

## Deploy to Fly.io (about 10 minutes)

### 1. Install the CLI and sign in

```bash
# macOS
brew install flyctl
# or: curl -L https://fly.io/install.sh | sh
fly auth signup   # or: fly auth login
```

### 2. Create the app

Run these from the project folder. The app name must be globally unique. It becomes `https://<name>.fly.dev`.

```bash
fly launch --no-deploy --copy-config --name storytime-yourname
```

When asked, keep the existing `fly.toml`. Pick the region closest to your users (for example `iad` for US East, `lhr` for London). Then set `app` and `primary_region` in `fly.toml` to match.

### 3. Create the persistent disk

```bash
fly volumes create storytime_data --size 3 --region iad   # use your region
```

### 4. Set secrets

```bash
fly secrets set \
  JWT_SECRET=$(openssl rand -hex 32) \
  SUPPORT_EMAIL=support@yourdomain.com \
  MODERATOR_USERNAMES=yourusername
```

- `JWT_SECRET` signs login sessions. The server refuses to start in production without a strong one.
- `SUPPORT_EMAIL` is shown in Help & Safety and in suspension messages.
- `MODERATOR_USERNAMES` is a comma-separated list of accounts that can open the moderation queue. Sign up with that username after deploying. You can add more moderators later.

### 5. Deploy

```bash
fly deploy
```

Then check it:

```bash
curl https://storytime-yourname.fly.dev/api/health    # → {"ok":true}
open https://storytime-yourname.fly.dev                # the web app
open https://storytime-yourname.fly.dev/privacy        # your privacy policy URL for the app stores
```

Production starts with an **empty database**: no demo users. Create your own account, including the moderator account you listed.

### 6. Point the mobile apps at it

Edit `.env.mobile` in the project:

```
VITE_API_URL=https://storytime-yourname.fly.dev
```

Then follow [MOBILE_RELEASE.md](MOBILE_RELEASE.md).

### Custom domain (optional)

```bash
fly certs add api.yourdomain.com
# add the DNS records it prints, then use https://api.yourdomain.com in .env.mobile
```

If you also host the web app on another domain, allow it with `fly secrets set CORS_ORIGINS=https://yourdomain.com`.

---

## Day-2 operations

| Task | Command |
| --- | --- |
| Logs | `fly logs` |
| Deploy a new version | `fly deploy` |
| Back up the database | `fly ssh console -C "node server/backup.js"` then `fly ssh sftp get /data/backups/<file>` |
| Download all media | `fly ssh sftp shell` → `get -r /data/uploads` |
| Add a moderator | `fly secrets set MODERATOR_USERNAMES=alice,bob` |
| Scale the machine up | `fly scale memory 1024` or `fly scale vm shared-cpu-2x` |
| Grow the disk | `fly volumes extend <volume-id> --size 10` |

Fly also keeps daily snapshots of volumes for 5 days (`fly volumes snapshots list <volume-id>`). Take your own backups before big changes anyway.

---

## Alternative: Render

1. Push this repo to GitHub.
2. In Render: **New → Blueprint** and select the repo. It reads `render.yaml`, which creates a Docker web service with a 5 GB disk at `/data` and generates `JWT_SECRET` for you.
3. Fill in `SUPPORT_EMAIL` and `MODERATOR_USERNAMES` when prompted.
4. Your URL will be `https://storytime-xxxx.onrender.com`. Use it in `.env.mobile`.

A persistent disk requires a paid Render plan (Starter or above).

---

## Any other Docker host

```bash
docker build -t storytime .
docker run -d -p 8080:8080 \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -e SUPPORT_EMAIL=support@yourdomain.com \
  -e TRUST_PROXY=true \
  -v storytime_data:/data \
  storytime
```

Put it behind HTTPS (a load balancer, Caddy, or nginx with Let's Encrypt). The app stores require HTTPS.

---

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` turns on strict checks, HSTS, and no demo data |
| `PORT` | `4000` (`8080` in Docker) | HTTP port |
| `DATA_DIR` | `./data` (`/data` in Docker) | Where `storytime.sqlite` and `uploads/` live. Must be persistent. |
| `JWT_SECRET` | dev value | **Required in production**, at least 32 random characters |
| `SUPPORT_EMAIL` | `support@example.com` | Shown in Help & Safety and in suspension messages |
| `MODERATOR_USERNAMES` | *(none)* | Comma-separated usernames that get the moderation queue |
| `CORS_ORIGINS` | *(none)* | Extra web origins allowed to call the API. The native app origins are always allowed. |
| `TRUST_PROXY` | `true` in production | Trust `X-Forwarded-For` from the host's proxy, so rate limits see real IPs |
| `RATE_LIMITS` | on | `off` disables rate limiting (only for automated tests) |
| `SEED` | on locally, off in production | `true` loads the demo world into an empty database |
| `BLOCKLIST_EXTRA` | *(none)* | Comma-separated extra words and phrases for the content filter |

## What's built in for production

- **Security:** bcrypt passwords, signed JWT sessions (password changes and "log out everywhere" revoke old ones), HTTPS-only (HSTS), `nosniff`/`DENY` framing headers, CORS limited to the native apps plus origins you list.
- **Abuse protection:** rate limits on login (30 per 15 minutes per IP), sign-up (10 per hour per IP), and all writes (120 per minute per user). There's also an upload type and size check (50 MB) and a content filter.
- **Reliability:** a health check at `/api/health` used by Fly and Docker, graceful shutdown on deploys, SQLite in WAL mode, and a one-command backup.
- **Migration:** if an old `data/db.json` exists from an earlier version, it's imported into SQLite automatically on first start.

## Scaling later

When a single machine isn't enough:

1. **Media → object storage** (S3, Cloudflare R2) behind a CDN. Only `server/uploads.js` touches the disk.
2. **Database → Postgres.** All data access goes through the small interface in `server/db.js` (`find/filter/insert/update/updateMany/remove`). Moving to an async database means making the route handlers `async`, which Express 5 supports.
3. **Real-time:** replace DM polling with WebSockets or Server-Sent Events.
4. **Push notifications:** add `@capacitor/push-notifications` with APNs/FCM.
