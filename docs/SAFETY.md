# Safety & moderation

Storytime is a user-generated content (UGC) app with messaging, so both app stores require real safety tooling. Here's what's built, how to run it day to day, and how it maps to the store rules.

## Store requirements → what Storytime does

| Requirement (Apple Guideline 1.2 / Google Play UGC policy) | Where it lives |
| --- | --- |
| Users agree to terms that forbid objectionable content and abusive users | Sign-up requires ticking **I agree to the Terms of Use and Community Guidelines**. Existing users are asked again whenever `TERMS_VERSION` changes (`server/lib/moderation.js`). Pages: `/terms`, `/guidelines`, `/privacy`. |
| A method for filtering objectionable material | `server/lib/contentFilter.js` blocks slurs and abusive phrases in usernames, names, bios, stories, captions, tags, highlight titles, story replies and DMs. It catches leetspeak (`f4g`), separators (`k.y.s`) and plurals, without false positives like "Scunthorpe" or "classic". There's also a per-story **Sensitive content** flag with a viewer filter that's on by default. |
| A mechanism to report offensive content, with timely responses | **Report** is in the ⋯ menu on every story and profile, under every received DM, and on every story reply. There are 11 reasons (spam, nudity, harassment, hate, violence, self-harm, child safety, illegal, IP, impersonation, other), optional details, and an option to block at the same time. Reports are anonymous, and a snapshot of the content is kept as evidence. |
| The ability to block abusive users | Block from any profile or report flow. Blocked people disappear from each other's feeds, search, profiles and DMs, and follows are removed. There's also **Mute** and **Not interested**. |
| Acting on reports within 24 hours and removing offending users | **Moderation queue** (`/moderation`, moderators only). Reports are grouped per item, most-reported first. Actions: **Dismiss**, **Remove content**, **Suspend account**, **Remove + suspend**. Every decision is logged in `moderationActions`. |
| Published contact information | Settings → Help & safety shows `SUPPORT_EMAIL`. The Terms and Privacy Policy include the contacts from `client/src/legal/config.js`. |
| In-app account deletion (Apple 5.1.1(v)); web deletion link (Google) | Settings → Delete account. Public instructions are at `/delete-account`. |

## How moderation works

1. **Report:** a user reports a story, account, reply or message. The same person can only have one open report per item.
2. **Auto-hide:** when **3 different people** report the same story, it's hidden from everyone except its author, who sees "Under review", until a moderator acts (`AUTO_HIDE_THRESHOLD`).
3. **Review:** moderators see each item with its content (or the saved snapshot, if the author deleted it), who reported it, why, and any details.
4. **Decide:**
   - **Dismiss:** reports are closed and an auto-hidden story is restored. Reporters are told no violation was found.
   - **Remove content:** the story is taken down for everyone and removed from highlights, or the DM or reply is deleted. The author gets a notice. Reporters are told action was taken.
   - **Suspend account:** the person is signed out everywhere, can't log in (they see a message with your support email), and their profile, stories and messages disappear from the app. Moderators can **unsuspend** from the Suspended tab.
5. **Appeals:** users email `SUPPORT_EMAIL`. Look up the account under Moderation → Suspended.

### Running it

- **Who is a moderator:** usernames in `MODERATOR_USERNAMES` (a server environment variable), or accounts with `role: "moderator"` in the database. The seeded demo moderator is `mod` / `password123`, local only.
- **Service level:** check the queue at least daily. Both stores expect action on reports within 24 hours. The Open tab shows the count.
- **Extending the filter:** add terms to `server/lib/blocklist.js`, or set `BLOCKLIST_EXTRA=word1,phrase two` on the server without a redeploy of the app.
- **Child safety:** remove the content, suspend the account, and report child sexual exploitation to NCMEC (US, via the [CyberTipline](https://report.cybertip.org)) or your local authority. Keep the report snapshot as evidence and don't share it.

## Not built yet (good next steps)

- Image and video scanning (for example AWS Rekognition, Hive, or PhotoDNA for CSAM hash matching).
- Push or email alerts to moderators when new reports come in.
- Time-limited suspensions and warning strikes.
- User-facing appeal form (email works for now).
