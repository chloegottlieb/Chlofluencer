# Storytime

**Stories first. Friends, then the world.**

Storytime is a social app built around 24-hour stories. You tap through them like Instagram stories, not scroll like TikTok. When you finish your friends' stories, you keep going: the next taps play stories from creators you don't follow yet, ranked by a For You algorithm. The goal is to make stories a place where vloggers and influencers can be discovered, not only where they keep up with the followers they already have.

<p align="center"><em>Tray of friends → tap through → "You're all caught up" → For You stories from new creators → Follow straight from the story.</em></p>

---

## Features

| Area | What you get |
| --- | --- |
| **Tap-through viewer** | Full-screen 9:16 stories with segmented progress bars. Tap the right side to go forward and the left side to go back. Press and hold to pause, swipe down or press Esc to close, and swipe left or right to skip a creator. Arrow keys and the space bar also work. Photos, videos and text-on-gradient stories are supported. |
| **Friends → For You** | Friends with unseen stories come first (their newest first). Then a "You're all caught up" card, then an endless, paginated queue of recommended strangers' stories labelled **For You** with a reason ("Because you're into #travel", "Trending", "Just posted", "New creator"). |
| **Discovery algorithm** | Ranks by declared interests, what you like, reply to and finish watching, creator affinity, engagement, popularity and freshness. It diversifies topics and adds a little seeded exploration. It never shows private accounts, followers-only stories, sensitive stories (if filtered), or creators you blocked, muted or marked "Not interested". |
| **In-app camera** | Take photos or record videos (up to 60 s) without leaving the app. Tap the shutter for a photo, or press and hold (or switch to Video) to record. You can flip between front and back cameras, and the selfie preview is mirrored. Review the shot, then choose **Retake** or **Use**. **Choose from camera roll** is always available too. |
| **Direct messages** | People who **follow each other** can DM, and a story reply between them lands in their conversation with a preview of the story. With a **one-way or no connection**, you can only send a **one-way story reply**. It lands in the creator's Activity → Story replies inbox, and they can't reply back. If a follow is dropped or someone blocks, the conversation stays readable but you can't send new messages. Shows unread badges and "Seen" receipts. |
| **Creator tools** | Post photo, video (up to 60 s) or text stories with captions, hashtags, audience (Everyone / Followers) and a "Show in For You" switch. Story insights show views, views that came from For You, likes, and the viewer list. |
| **Highlights** | Save any of your stories, active or expired, to named highlights from the viewer or from your private **Archive**. Rename, reorder the cover, add, remove, and delete. Highlights stay on your profile permanently. |
| **Profiles** | Profile picture upload, name, bio (150 characters), website, interests, follower and following lists, a ring around the avatar when there's an active story, a "Follows you" badge, and activity status. |
| **Social** | Follow and unfollow, follow requests for private accounts, likes, story replies, direct messages, notifications, search, block, mute, and "Not interested". |
| **Settings** | Privacy, For You and discovery, your stories, playback, notifications, appearance, blocked/muted/hidden lists, change password, log out of all devices, and delete account. [Full list below](#settings-reference). |

---

## Requirements

- **Node.js 20.10 or newer** (tested on Node 22). Check with `node -v`. Get it from <https://nodejs.org> or with a version manager such as `nvm install 22`.
- **npm 10+**, which ships with Node.
- **git**.
- About 300 MB of disk for `node_modules`, plus about 150 MB for the Playwright browser if you run the end-to-end tests.

There's no database server or other external service to set up. Data is stored in a JSON file under `./data`.

---

## Download and run

### 1. Get the code

```bash
git clone https://github.com/chloegottlieb/Chlofluencer.git
cd Chlofluencer   # the repository keeps its original name
# Use the feature branch if it hasn't been merged yet:
git checkout claude/stories-discovery-social-app-c7tcmk
```

(Or download the ZIP from GitHub with **Code → Download ZIP**, unzip it, and `cd` into the folder.)

### 2. Install dependencies

```bash
npm install
```

### 3. Start the app in development mode

```bash
npm run dev
```

This starts two processes:

- **API server** at <http://localhost:4000>, which restarts when server files change.
- **Web app** at <http://localhost:5173>, with hot reload. It proxies `/api` and `/uploads` to the API.

On first start the API seeds a demo world: 11 creators plus your `demo` account, stories spread over the last 20 hours, a highlight, and some engagement.

### 4. Open it

Open **<http://localhost:5173>** in your browser. It's designed mobile-first, so it looks best in a narrow window or with your browser's device toolbar (Chrome DevTools → Toggle device toolbar).

Log in with the demo account:

| Username | Password |
| --- | --- |
| `demo` | `password123` |

Every seeded account (`maya.travels`, `leo.lifts`, `priya.cooks`, `zoe.wanders`, `sofia.style`, `sam.private`, …) also uses `password123`. You can also **sign up** for a new account.

**Try this:**
1. Tap **▶ Watch 3 friends' stories** and keep tapping the right side. When your friends run out you'll see *You're all caught up*. Keep going to reach For You creators, then tap **Follow** on one you like.
2. Tap ✈ in the top-right corner. `maya.travels` (you follow each other) has sent you a DM.
3. Open **Activity → Story replies** to see a one-way reply from `zoe.wanders`. You don't follow each other, so you can't reply back.
4. Tap **＋ → Photo / Video → Open camera** to take a photo or video in the app.

### Production-style run (single server)

```bash
npm run build   # builds the React app into ./dist
npm start       # serves the API and the built app at http://localhost:4000
```

### Try it on your phone (camera included)

Browsers only allow camera access on `https://` or `localhost`. To test the in-app camera on a real phone on the same Wi-Fi:

```bash
npm run dev:phone
```

This serves the app over HTTPS with a self-signed certificate. Vite prints a **Network** address such as `https://192.168.1.23:5173`. Open that address on your phone and accept the certificate warning (on iPhone, tap *Show Details → visit this website*; in Chrome for Android, tap *Advanced → Proceed*). Allow camera access when asked.

Without HTTPS, the camera screen explains why it can't start and offers **Choose from camera roll** instead. The camera roll picker works over plain HTTP too.

### Reset the demo data

```bash
npm run seed    # wipes ./data/db.json and re-seeds the demo world
```

To start completely fresh, delete the `data/` folder. It's recreated (and re-seeded) on the next start.

### Configuration (environment variables)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API/server port |
| `DATA_DIR` | `./data` | Where `db.json` and uploaded media are stored |
| `JWT_SECRET` | `dev-only-secret-change-me` | Secret used to sign login tokens. **Set this to a long random value anywhere real.** |
| `SEED` | *(on)* | Set to `false` to start with an empty database instead of the demo world |
| `API_PORT` | `4000` | Where the Vite dev server proxies API calls (only needed if you change `PORT` in dev) |

Example: `PORT=5000 JWT_SECRET=$(openssl rand -hex 32) npm start`.
On Windows PowerShell: `$env:PORT=5000; npm start`.

---

## Testing

The test suite has four layers:

| Layer | Tooling | Location | Command |
| --- | --- | --- | --- |
| Unit: feed algorithm, validation, settings, storage, player logic, formatting | Vitest | `tests/unit/` | `npm test` |
| API integration: every endpoint against an in-memory DB with a controllable clock (so 24-hour expiry is tested) | Vitest + Supertest | `tests/api/` | `npm test` |
| Component: story viewer, camera, messages, home, auth, settings, create, profile, activity | Vitest + Testing Library + jsdom | `tests/client/` | `npm test` |
| End-to-end: the BDD scenarios below, in a real Chromium on a Pixel-7 viewport (with a simulated camera and microphone) against a freshly seeded server | Playwright | `e2e/` | `npm run test:e2e` |

```bash
npm test                 # unit + API + component tests (~10 s)
npm run test:coverage    # same, with a coverage report in ./coverage
npm run test:watch       # re-run on file changes

# End-to-end (one-time browser download first):
npx playwright install chromium
npm run test:e2e         # builds the app, starts a fresh seeded server on :4700, runs Playwright
npx playwright test --ui # interactive runner
npx playwright show-report

npm run test:all         # everything
```

> On Linux CI machines, use `npx playwright install --with-deps chromium` to also install the system libraries Chromium needs.

The current suite has **320** unit, API and component tests plus **34** end-to-end scenarios.

---

## BDD test scenarios (end-to-end)

These Gherkin scenarios describe the MVP's behavior. Each one is **automated** in a Playwright spec whose test title matches the scenario name. The `.feature` files live in `e2e/features/`, so you can also use them as a manual QA script, or plug them into a Cucumber runner such as [`playwright-bdd`](https://github.com/vitalets/playwright-bdd) later.

Scenarios that need time travel, such as "a story disappears after 24 hours", are covered in the API tests (`tests/api/stories.test.js`, `feed.test.js` and `highlights.test.js`), which control the server clock.

#### `e2e/features/accounts.feature` → automated in `e2e/accounts.spec.js`

```gherkin
Feature: Accounts and profiles
  As a new creator
  I want to sign up and build a profile
  So that people who discover my stories can learn about me

  Scenario: Sign up with interests
    Given I am on the sign up page
    When I enter a unique username, email and a valid password
    And I pick the interests "#travel" and "#food"
    And I submit the form
    Then I land on the home screen with the stories tray
    And my profile lists the interests "#travel" and "#food"

  Scenario: Log in with the demo account
    Given the demo data has been seeded
    When I log in as "demo" with password "password123"
    Then I see my friends "maya.travels", "leo.lifts" and "priya.cooks" in the stories tray
    And I see a "For You" section of creators I don't follow

  Scenario: Log in with a wrong password
    When I log in as "demo" with password "wrong-password1"
    Then I see the error "Incorrect username or password"

  Scenario: Edit my profile picture and bio
    Given I am logged in
    When I open "Edit profile"
    And I upload a profile picture
    And I set my bio to "Vlogging my life one story at a time"
    And I save
    Then my profile shows the bio and my new profile picture

  Scenario: Bio length is limited
    Given I am logged in
    When I enter a bio longer than 150 characters and save
    Then I see the error "Bio must be 150 characters or fewer"
```

#### `e2e/features/stories.feature` → automated in `e2e/stories.spec.js`

```gherkin
Feature: Instagram-style tap-through stories
  Stories last 24 hours and are watched by tapping, not scrolling.

  Background:
    Given I am logged in
    And I follow "friend-b" who posted 1 story
    And I follow "friend-a" who then posted 2 stories
    # Friends with the most recent unseen stories lead the tray.

  Scenario: Tap through friends' stories in order
    When I tap "Watch 2 friends' stories"
    Then I see friend-a's first story with 2 progress segments
    When I tap the right side of the screen
    Then I see friend-a's second story
    When I tap the right side of the screen
    Then I see friend-b's story
    When I tap the left side of the screen
    Then I see friend-a's second story again

  Scenario: Finishing friends' stories rolls into strangers' stories
    When I watch all of my friends' stories
    Then I see "You're all caught up"
    When I tap "Discover new creators"
    Then I see a story from a creator I don't follow
    And it is labelled "For You" with a reason such as "Trending"
    And I can keep tapping to the next recommended creator

  Scenario: Press and hold pauses the story
    When I open friend-a's story
    And I press and hold on the story
    Then the story is paused
    When I release
    Then the story resumes

  Scenario: Stories auto-advance
    When I open friend-b's story
    And I wait longer than the photo duration
    Then the viewer moves on to the next story

  Scenario: Watched friends move to the end of the tray
    When I watch friend-a's stories and close the viewer
    Then friend-a's ring is grey (seen) and appears after unseen friends

  Scenario: Like and reply to a friend's story
    When I open friend-a's story
    And I tap the heart
    And I reply "Love this!"
    Then I see "Reply sent"
    And friend-a sees my reply under Activity → Story replies
    And friend-a sees a "liked your story" notification
```

#### `e2e/features/discovery.feature` → automated in `e2e/discovery.spec.js`

```gherkin
Feature: For You discovery of new creators

  Scenario: Follow a creator straight from their story
    Given I am a new user who follows nobody
    When I tap "Start watching" in the For You section
    And I tap "Follow" on the first recommended creator
    Then I see "Following <creator>"
    And after closing the viewer the creator appears in my friends' tray

  Scenario: "Not interested" hides a creator from For You
    Given I am watching For You stories
    When I choose "Not interested" from the ⋯ menu
    Then the creator no longer appears in the For You section
    And they are listed under Settings → "Hidden from For You"

  Scenario: Turning off discovery stops after friends
    Given I have turned off "Discover new creators" in Settings
    Then the home screen says discovery is off
    And no For You cards are shown

  Scenario: Recommendations match my interests
    Given I signed up with the interest "#travel"
    When I open the home screen
    Then a travel creator's card says "Because you're into #travel"

  Scenario: Private accounts never appear in For You
    Given "sam.private" has a private account with an active story
    When I browse For You
    Then I never see "sam.private"
```

#### `e2e/features/messages.feature` → automated in `e2e/messages.spec.js`

```gherkin
Feature: Direct messages and story replies
  Two people who follow each other can DM. Otherwise, the only way to reach
  a creator is a one-way story reply, which they can read but not answer.

  Scenario: Mutual follows can message each other
    Given "alex" and "blair" follow each other
    When alex opens Messages and starts a new message to blair
    And alex sends "Coffee later?"
    Then blair sees an unread badge on the Messages icon
    And blair opens the conversation and sees "Coffee later?"
    When blair replies "Yes! 3pm"
    Then alex sees "Yes! 3pm" in the conversation
    And alex's message is marked "Seen"

  Scenario: A story reply between mutuals goes to DMs
    Given "alex" and "blair" follow each other
    And blair has posted a story
    When alex opens blair's story
    Then the reply box says "Message blair…"
    When alex sends "Where is this?!"
    Then alex sees "Sent to your messages"
    And blair's conversation with alex shows the reply with a preview of the story
    And blair can reply in the conversation

  Scenario: One-way follow gives a one-way story reply
    Given "fan" follows "creator" but creator does not follow back
    And creator has posted a story
    When fan opens creator's story
    Then the reply box says "Reply to creator…"
    When fan sends "Huge fan!"
    Then fan sees "Reply sent"
    And creator sees "Huge fan!" under Activity → Story replies marked "One-way reply"
    And creator has no conversation with fan in Messages
    And fan's profile has no "Message" button for creator

  Scenario: Strangers can only reply to stories
    Given "stranger" and "creator" don't follow each other
    When stranger visits creator's profile
    Then there is no "Message" button
    And opening creator's conversation directly shows "once you both follow each other" with no message box

  Scenario: Unfollowing makes a conversation read-only
    Given "alex" and "blair" have been messaging
    When blair unfollows alex
    Then alex's conversation with blair still shows the history
    But the message box is replaced with "once you both follow each other"
```

#### `e2e/features/posting-and-highlights.feature` → automated in `e2e/posting.spec.js`

```gherkin
Feature: Posting stories and saving highlights

  Scenario: Post a text story
    Given I am logged in
    When I tap the "+" tab
    And I type "My first vlog day!" and choose a background
    And I add the tags "#vlog #travel"
    And I tap "Share to your story"
    Then "Your story" in the tray shows a ring
    And tapping it plays my story with a view count

  Scenario: Post a photo story from the camera roll
    Given I am logged in
    When I tap "Choose from camera roll" in the Photo / Video tab and pick a photo
    And I share it
    Then my story plays the photo

  Scenario: Take a photo with the in-app camera and post it
    Given I am logged in and have allowed camera access
    When I tap "Open camera" in the Photo / Video tab
    And I tap the shutter
    Then I see the photo I just took
    When I tap "Use photo" and share it
    Then my story plays the photo

  Scenario: Record a video with the in-app camera and post it
    Given I am logged in and have allowed camera access
    When I open the camera and switch to "Video"
    And I tap the shutter to start recording
    Then I see a recording timer
    When I tap the shutter again after a couple of seconds
    And I tap "Use video" and share it
    Then my story plays the video for as long as I recorded

  Scenario: Retake and flip the camera
    Given the in-app camera is open
    When I tap "Flip camera"
    Then the preview switches to the front camera, mirrored like a selfie
    When I take a photo and tap "Retake"
    Then the live camera comes back

  Scenario: Save my story to a new highlight from the viewer
    Given I have posted a story
    When I open my story and tap "Highlight"
    And I create a highlight called "Best of"
    Then I see "Saved to new highlight Best of"
    And my profile shows the "Best of" highlight
    And other users can watch it even after the story expires

  Scenario: Build a highlight from the archive
    Given I have posted two stories
    When I open Archive and select both stories
    And I add them to a new highlight called "Trips"
    Then my profile shows the "Trips" highlight with 2 stories

  Scenario: Delete a story
    Given I have posted a story
    When I open my story and tap "Delete" and confirm
    Then the story is gone from my tray
```

#### `e2e/features/privacy-and-settings.feature` → automated in `e2e/privacy.spec.js`

```gherkin
Feature: Privacy and settings

  Scenario: Private account requires follow approval
    Given "owner" has turned on "Private account"
    When "fan" visits owner's profile
    Then fan sees "This account is private"
    When fan taps "Follow"
    Then the button says "Requested"
    When owner confirms the request under Activity
    Then fan can see owner's highlights

  Scenario: Block a user
    Given I visit "pest"'s profile
    When I choose "Block" from the ⋯ menu
    Then pest can no longer find my profile
    And pest appears under Settings → Blocked accounts where I can unblock them

  Scenario: Turn off story replies
    Given I set "Allow story replies from" to "Off"
    When a follower opens my story
    Then they see "Replies are off" instead of the reply box

  Scenario: Switch to light theme
    When I set "Theme" to "Light"
    Then the app renders with the light theme

  Scenario: Change password
    When I change my password
    Then I can log in with the new password and not the old one
```

#### Extra scenarios for manual QA (covered by API or component tests)

```gherkin
Feature: 24-hour lifecycle
  Scenario: A story disappears from everyone's feed after 24 hours
    Given "maya" posted a story 23 hours and 59 minutes ago
    Then her followers still see it in the tray
    When one more minute passes
    Then it is gone from the tray and from For You
    But maya still sees it in her Archive with its posting date

  Scenario: Highlighted stories outlive the 24-hour window
    Given maya saved a story to the highlight "Bali"
    When 48 hours pass
    Then anyone who can see maya's profile can watch "Bali"

  Scenario: Turning off "Save stories to archive" deletes expired stories
    Given maya turned off "Save stories to archive"
    When her story expires
    Then it is permanently deleted unless it's in a highlight

Feature: In-app camera on real devices (manual)
  Scenario: Camera permission denied
    Given I denied camera access in my browser
    When I tap "Open camera"
    Then I see "Camera access is blocked"
    And "Choose from camera roll" opens my photo library

  Scenario: Plain http on a phone
    Given I opened the app over http:// on my phone's network address
    When I tap "Open camera"
    Then I'm told the camera needs https:// and offered the camera roll instead

  Scenario: Selfie video on iPhone Safari and Android Chrome
    When I flip to the front camera and hold the shutter for 5 seconds
    Then the story plays my 5-second video with sound

Feature: For You learns from behaviour
  Scenario: Likes teach the algorithm
    Given I like a story tagged "#tech"
    Then other "#tech" creators rank higher in my For You
    And their card says "Because you're into #tech"

  Scenario: Quick skips teach the algorithm too
    Given I skip a creator's stories within the first second several times
    Then that creator ranks lower in my For You

  Scenario: Reset recommendations
    When I tap "Reset For You recommendations" in Settings
    Then creators I hid and stories I watched in For You become eligible again
```

---

## How the For You algorithm works

All ranking lives in [`server/lib/feed.js`](server/lib/feed.js) as pure functions. The route in [`server/routes/feed.js`](server/routes/feed.js) collects a snapshot of the viewer's data and passes it in, which keeps the ranking easy to unit test.

1. **Eligibility** (`isDiscoverable`): the story is active, public, and allowed in For You. The creator is not you, not someone you follow, not private, hasn't opted out, and isn't blocked, muted or marked "Not interested". You haven't already watched it, and it isn't sensitive (unless you turned the filter off).
2. **Taste profile** (`buildTagAffinity`): a weight for each hashtag, built from:
   - your declared interests: +1
   - stories you liked: +2
   - stories you replied to: +2
   - stories you watched to at least 90%: +1
   - stories you skipped before 30%: −0.5
3. **Score per story** (`scoreStory`), when personalized:
   `0.35·interest + 0.25·engagement + 0.10·popularity + 0.20·freshness + 0.10·creator affinity`
   - *interest* = `1 − e^(−Σ matching tag weights / 2)`
   - *engagement* = Bayesian-smoothed `(2·likes + 3·replies + completions) / (views + 3)`
   - *popularity* = `log10(1 + views) / 3`, capped at 1
   - *freshness* = `e^(−age_hours / 10)`
   - *creator affinity* = how much of this creator's stories you usually finish, plus a boost if you've liked them (range −1 to 1)

   With **Personalized recommendations** turned off, the formula becomes `0.45·engagement + 0.25·popularity + 0.30·freshness`.
4. **Group by creator** so For You still taps through like stories. Each creator's score is their best story's score, plus a small bonus for having more stories, plus ±0.05 of seeded exploration jitter. The seed changes every hour, so pagination stays consistent.
5. **Diversify**: a greedy re-rank that multiplies a creator's score by 0.85 if their main hashtag matches the previous creator's, so you don't get five travel vloggers in a row.
6. **Paginate**: the client asks for more (`/api/feed/discover?exclude=…`) when two creators are left in the queue, so the For You queue has no end.

Friends are simpler: people you follow who have active stories, those with unseen stories first, then the most recent first, each starting at your first unseen story.

---

## Settings reference

| Section | Setting | Default | Notes |
| --- | --- | --- | --- |
| Privacy | Private account | off | New followers need approval. Private accounts never appear in For You. Switching back to public approves pending requests. |
| | Allow story replies from | Everyone | Everyone / People you follow / Off |
| | Show activity status | on | Reciprocal: turn it off and you also stop seeing other people's |
| | Show view & like counts | on | Hides counts from viewers (you always see your own) |
| For You & discovery | Discover new creators | on | Off: the viewer stops after your friends |
| | Recommend my stories | on | Lets your public stories appear in strangers' For You |
| | Personalized recommendations | on | Off: ranks by trending and fresh stories only |
| | Filter sensitive content | on | Hides stories marked sensitive |
| | Reset For You recommendations | — | Clears For You watch history and "Not interested" |
| Your stories | Default audience | Everyone | Everyone / Followers only |
| | Save stories to archive | on | Off: expired stories are deleted unless they're in a highlight |
| | Allow likes | on | |
| Playback | Auto-advance | on | |
| | Photo story duration | 5 s | 3–15 s. Long text stories get extra reading time. |
| | Start videos muted | off | |
| | Data saver | off | Doesn't preload video |
| Notifications | Pause all, likes, replies, new followers, follow requests | on | |
| Appearance | Theme | Dark | Dark / Light / Match system |
| | Reduce motion | off | |
| Account | Edit profile, archive, follow requests, blocked / muted / hidden lists, change password, log out, log out of all devices, delete account | — | |

---

## Project structure

```
.
├── client/                   React 19 single-page app (Vite)
│   ├── index.html
│   └── src/
│       ├── App.jsx           routes and auth gate
│       ├── api.js            fetch wrapper (JWT bearer token)
│       ├── auth.jsx          auth context and theme application
│       ├── lib/player.js     pure queue/cursor logic for the tap-through viewer
│       ├── lib/time.js       relative time and count formatting
│       ├── lib/camera.js     camera helpers (recorder format, 9:16 crop, errors)
│       ├── components/       StoryViewer, CameraCapture, HighlightPicker, ViewersSheet, MessagesLink, …
│       └── pages/            Home, Create, Messages, Conversation, Profile, EditProfile, Settings, Archive, Activity, Search, Login, Signup
├── server/                   Express 5 API
│   ├── index.js              entry point (auto-seeds an empty DB)
│   ├── app.js                createApp({ db, now, uploadDir, … }) with injectable dependencies for tests
│   ├── db.js                 small JSON-file document store
│   ├── auth.js               bcrypt, JWT, auth middleware
│   ├── uploads.js            multer config (images and videos, 50 MB)
│   ├── seed.js               demo world, with SVG images generated offline
│   ├── lib/feed.js           ★ the friends + For You ranking algorithm
│   ├── lib/social.js         follow, block and visibility rules; notifications
│   ├── lib/messaging.js      who can DM whom (mutual follows only)
│   ├── lib/settings.js       settings schema, defaults and validation
│   ├── lib/validation.js     input validation
│   └── routes/               auth, users, stories, feed, highlights, messages, settings, notifications
├── tests/
│   ├── unit/                 pure-logic tests
│   ├── api/                  Supertest integration tests
│   └── client/               React Testing Library tests
├── e2e/
│   ├── features/*.feature    BDD scenarios (Gherkin)
│   └── *.spec.js             Playwright implementations
├── playwright.config.js
└── vite.config.js            Vite and Vitest config
```

## API reference

All endpoints are under `/api` and take and return JSON. Everything except `signup`, `login` and `health` needs an `Authorization: Bearer <token>` header.

| Method & path | Description |
| --- | --- |
| `POST /auth/signup` | `{ username, email, password, displayName?, interests? }` → `{ token, user }` |
| `POST /auth/login` | `{ login (username or email), password }` → `{ token, user }` |
| `GET /auth/me` · `POST /auth/logout-everywhere` | Current user with settings · revoke all tokens |
| `GET /feed?discoverLimit=10` | `{ me, friends[], discover[], discoverEnabled, discoverHasMore }` |
| `GET /feed/discover?limit=&exclude=id,id` | Next page of For You creators |
| `POST /stories` (multipart) | `media` file *or* `text`, plus `background`, `caption`, `tags`, `audience`, `allowDiscovery`, `sensitive`, `durationMs` |
| `GET /stories/mine` · `/stories/archive` · `/stories/replies` | Your active stories · all your stories · replies inbox |
| `GET/DELETE /stories/:id` | View or delete a story |
| `POST /stories/:id/view` | `{ completion 0–1, source: friends\|discover\|highlight }` |
| `POST/DELETE /stories/:id/like` · `POST /stories/:id/reply` | Like/unlike · `{ text }`. Returns `delivered: "dm"` between mutual follows, otherwise `"reply"` (one-way). |
| `GET /stories/:id/viewers` | Insights (author only) |
| `GET /users/search?q=` · `GET /users/:username` · `GET /users/:username/stories` | Search · profile · active stories |
| `PATCH /users/me` · `POST/DELETE /users/me/avatar` · `DELETE /users/me` | Edit profile · profile picture · delete account (`{ password }`) |
| `POST/DELETE /users/:username/{follow,block,mute,not-interested}` | Relationships |
| `DELETE /users/:username/follower` | Remove a follower |
| `GET /users/:username/{followers,following}` | Lists |
| `GET /users/me/{requests,blocked,muted,not-interested}` · `POST /users/me/requests/:userId/{accept,decline}` | Manage follow requests and hidden accounts |
| `GET /highlights/user/:username` · `GET /highlights/:id` | List · watch |
| `POST /highlights` · `PATCH /highlights/:id` · `DELETE /highlights/:id` | `{ title, storyIds }` · `{ title?, addStoryIds?, removeStoryIds?, coverStoryId? }` |
| `GET/PATCH /settings` · `POST /settings/password` · `POST /settings/reset-recommendations` | Settings |
| `GET /notifications` · `POST /notifications/read` | Activity |
| `GET /messages` · `GET /messages/unread` · `GET /messages/contacts` | Inbox (conversations with unread counts) · unread total · people you can message (mutual follows) |
| `GET /messages/:username` · `POST /messages/:username` | Open a thread (marks it read, includes `canMessage` and `reason`) · send `{ text }`. Returns 403 `reason: not_mutual` unless you follow each other. |

---

## Troubleshooting

- **`EADDRINUSE` / port already in use**: another process is using port 4000 or 5173. Stop it, or run `PORT=4001 API_PORT=4001 npm run dev`.
- **Login says "Session expired"** after a restart with a different `JWT_SECRET`: log in again.
- **Playwright can't find a browser**: run `npx playwright install chromium`.
- **Weird data**: run `npm run seed`, or delete `./data`.
- **Camera won't start**: you need `https://` or `localhost` (use `npm run dev:phone` on a phone), camera permission for the site, and no other app using the camera.
- **Don't see the demo DMs?** Your `./data` was created before messaging existed. Run `npm run seed` to rebuild the demo world.
- **Videos don't autoplay with sound**: browsers block autoplay with sound until you interact with the page. Tap the 🔇 button.

## MVP limitations and next steps

- Storage is a single JSON file. That's fine for demos and small groups. Swap `server/db.js` for Postgres or SQLite before real traffic, since the rest of the server only uses its small `find/filter/insert/update/remove` interface.
- Media is stored on local disk with no transcoding. A real deployment would use object storage (S3 or similar) and a CDN.
- There are no real-time updates over WebSockets. Open conversations check for new messages every 4 seconds, the unread badge every 15 seconds, and the feed refreshes when you close the viewer or navigate.
- The camera has no filters, zoom, flash or text/sticker editing yet. Recorded videos are uploaded as the browser recorded them (MP4 on Safari and recent Chrome, WebM on older Chrome and Firefox). Older iPhones may not play WebM stories.
- DMs are text-only. Photos and voice notes in DMs, message requests, reporting and content moderation, close-friends lists, stickers and music (Spotify) are natural next features.
