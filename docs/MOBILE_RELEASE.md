# Releasing Storytime on the App Store and Google Play

Storytime's iOS and Android apps are built with **[Capacitor](https://capacitorjs.com)**. The same React app runs inside a native shell (`ios/` and `android/` in this repo), with native permission prompts, app icons and splash screens. The apps talk to your hosted backend over HTTPS.

```
React app (client/) ──vite build──▶ dist/ ──cap sync──▶ ios/App/App/public
                                                   └──▶ android/app/src/main/assets/public
```

> **Not yet built on a device.** The native projects were generated from Capacitor's official templates and configured in this repo, but they couldn't be compiled here (no macOS or Android SDK). Your first build in Xcode and Android Studio is the real test. Please report anything that fails.

---

## 0. Before you start

- [ ] **Backend deployed** with HTTPS. Follow [DEPLOYMENT.md](DEPLOYMENT.md). You'll have a URL like `https://storytime-yourname.fly.dev`.
- [ ] **Legal details filled in** in `client/src/legal/config.js`: company name, address, privacy and support emails, governing law. Anything still in `[brackets]` shows up highlighted in yellow in the app. Have a lawyer review the policy text for your situation; it's a standard template, not legal advice.
- [ ] **Your moderator account exists** in production (a username in `MODERATOR_USERNAMES`), and you can open **Settings → Moderation queue**.
- [ ] **A reviewer demo account** in production, for example `appreview` with a strong password. Have it follow a couple of accounts that post stories and exchange a DM, so reviewers can see every feature.
- [ ] Tools:
  - **iOS:** a Mac with **Xcode 16 or newer**, and your Apple Developer Program membership.
  - **Android:** **Android Studio** (latest; it bundles the JDK 21 that Capacitor 8 needs), and a **Google Play Console** account ($25 one-time).

### Pick your app ID (do this once, before the first upload)

The default ID is **`app.storytime.social`**. App IDs are permanent once published, so use a reverse domain you control, such as `com.yourcompany.storytime`:

1. `capacitor.config.json` → `"appId"`
2. iOS: Xcode → **App** target → **Signing & Capabilities** → **Bundle Identifier**
3. Android: `android/app/build.gradle` → `applicationId` (you can leave `namespace` as it is)

---

## 1. Build the web app into the native projects

```bash
# one-time: point the apps at your backend
echo "VITE_API_URL=https://storytime-yourname.fly.dev" > .env.mobile

npm install
npm run build:mobile      # checks the URL, builds, and copies into ios/ + android/
```

Run `npm run build:mobile` again **every time you change the front-end code**. Backend-only changes just need `fly deploy`, with no app update or store review.

---

## 2. iOS: Xcode → TestFlight → App Store

### Open and sign

```bash
npm run ios          # build:mobile + opens ios/App/App.xcodeproj in Xcode
```

In Xcode:

1. Select the **App** project → **App** target → **Signing & Capabilities**.
2. Tick **Automatically manage signing** and choose your **Team**.
3. Check the **Bundle Identifier** (see "Pick your app ID" above).
4. **General** tab: **Display Name** `Storytime`, **Version** `1.0.0`, **Build** `1`. Increase Build for every upload. The app is set to **iPhone only, portrait**.

### Test on your iPhone

Plug in your phone, choose it as the run destination, and press **▶**. The first time, trust the developer profile on the phone (Settings → General → VPN & Device Management). Check:

- Log in and sign up (the terms checkbox is required).
- **＋ → Photo / Video → Open camera**. You'll see the in-app "Say cheese!" screen, then iOS's own prompt with the camera text below. Take a photo, record a video with sound, try Hands-free, and flip cameras.
- **Choose from camera roll** opens the iOS photo picker.
- Tap through stories, send a DM, report something, and block someone.

### Permission text (already in `ios/App/App/Info.plist`)

| Key | What iOS shows |
| --- | --- |
| `NSCameraUsageDescription` | "Storytime needs your camera so you can snap stories. We promise not to judge your angles. 📸" |
| `NSMicrophoneUsageDescription` | "Storytime uses your mic to add sound to your video stories. Sing, talk, laugh. Just maybe don't chew. 🎙️" |
| `NSPhotoLibraryUsageDescription` | "Storytime opens your camera roll so you can share the good stuff. We only see what you pick. No snooping. 🖼️" |

`ITSAppUsesNonExemptEncryption = NO` is also set, because the app only uses standard HTTPS. That answers App Store Connect's export compliance question automatically.

### Upload

1. Set the run destination to **Any iOS Device (arm64)**.
2. **Product → Archive**. When the Organizer opens, choose **Distribute App → App Store Connect → Upload**.
3. The build appears in [App Store Connect](https://appstoreconnect.apple.com) → your app → **TestFlight** after processing (about 10 to 30 minutes). Install it through TestFlight and test again.

### App Store Connect listing

Create the app under **My Apps → ＋ New App** (platform iOS, your bundle ID, SKU `storytime-ios`). "Storytime" may already be taken as a store name. If so, try something like "Storytime: Stories & Creators".

| Field | Suggested value |
| --- | --- |
| Category | **Social Networking** (secondary: Photo & Video) |
| Privacy Policy URL | `https://<your-backend>/privacy` |
| Support URL | `https://<your-backend>/guidelines`, or your own support page |
| Age rating | Answer the questionnaire honestly. Declare **user-generated content** and **messaging**. Expect **13+** or higher. |
| Sign-in required | Yes. Provide the reviewer demo account under **App Review Information**. |

**App Privacy ("nutrition label")** answers for this codebase:

| Data type | Collected | Linked to user | Used for tracking | Purpose |
| --- | --- | --- | --- | --- |
| Name, email address | Yes | Yes | No | App functionality |
| User ID (username) | Yes | Yes | No | App functionality |
| Photos or videos | Yes | Yes | No | App functionality |
| Audio (in videos) | Yes | Yes | No | App functionality |
| Other user content (stories, replies, messages) | Yes | Yes | No | App functionality |
| Product interaction (views, likes, follows) | Yes | Yes | No | App functionality, product personalisation |
| Other diagnostic data (server logs, IP address for rate limiting) | Yes | No | No | App functionality (security) |
| Anything else (location, contacts, health, payments, ads) | No | | | |

There's no third-party SDK, analytics or advertising, and nothing is used for tracking.

**Notes for the reviewer** (paste into App Review Information → Notes and adjust):

> Storytime is a stories-first social app. Log in with the demo account above.
>
> User-generated content safeguards (Guideline 1.2):
> • Users must agree to the Terms of Use and Community Guidelines (no tolerance for objectionable content or abusive users) before creating an account.
> • An automated filter blocks slurs and abusive phrases in stories, captions, tags, bios, usernames, replies and messages.
> • Any story, account, reply or direct message can be reported from its ⋯ menu (or the "Report" link under a message). Stories reported by 3 people are hidden automatically until reviewed.
> • Users can block (and mute) anyone from the same menus. Blocking removes the content from their feed immediately.
> • Our moderation team reviews reports in an in-app queue within 24 hours and can remove content and suspend accounts. Reporters and authors are notified of outcomes.
> • Contact: <your support email>, also shown in Settings → Help & safety.
>
> Account deletion: Settings → Delete account (also documented at /delete-account).
> Camera and microphone are only used when the user opens the in-app camera to create a story.

**Screenshots:** you need a set for the **6.9" iPhone** (1320 × 2868). The easiest way is to run the app in the iPhone 16 Pro Max simulator and press ⌘S. Show the story viewer, the "You're all caught up → For You" moment, the camera, DMs and a profile.

Submit for review from **App Store → ＋ Version → Add build → Submit for Review**.

---

## 3. Android: Android Studio → Google Play

### Open and run

```bash
npm run android      # build:mobile + opens android/ in Android Studio
```

Let Gradle sync finish, pick a device or emulator, and press **Run ▶**. Check the same things as on iOS. On Android the system permission prompt can't be customised, so the in-app "Say cheese!" screen carries the friendly explanation. The **hardware back button** goes back through screens and exits from Home.

Permissions declared in `android/app/src/main/AndroidManifest.xml`: `INTERNET`, `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`. Camera and microphone are marked optional, so devices without them can still install the app. The app is portrait-only.

### Version and signing

1. In `android/app/build.gradle`, increase `versionCode` (1, 2, 3, …) for every upload and set `versionName` (for example `"1.0.0"`).
2. **Build → Generate Signed App Bundle or APK → Android App Bundle**. Create a new **upload keystore** the first time.
   **Back up the keystore file and its passwords somewhere safe.** You need them for every future update.
3. Choose the **release** variant and **Create**. You'll get `android/app/release/app-release.aab`.
4. When Play Console offers **Play App Signing**, accept it (recommended).

### Play Console listing

Create the app (**All apps → Create app**: App, Free), then work through **Dashboard → Set up your app**:

| Section | What to enter |
| --- | --- |
| Privacy policy | `https://<your-backend>/privacy` |
| App access | "All or some functionality is restricted". Add the reviewer demo login. |
| Ads | No |
| Content rating | Category **Social**. Answer yes to users interacting and sharing content (UGC) and to messaging. |
| Target audience | **13 and over**. Not designed for children. |
| Data safety | Same data as the Apple table above. Data is **encrypted in transit**, users **can request deletion**, and nothing is shared with third parties. Account deletion URL: `https://<your-backend>/delete-account` |
| App category | Social |

Google Play's **User Generated Content policy** needs terms acceptance, in-app reporting, blocking and ongoing moderation. All of these are built in, as listed in the reviewer notes above.

Upload the `.aab` to **Testing → Internal testing** first, install it from the Play Store on your phone, then promote it to **Production**.

---

## 4. Shipping updates

| What changed | What to do |
| --- | --- |
| Backend only (`server/`) | `fly deploy`. Live instantly, no store review. |
| App UI (`client/`) | `npm run build:mobile`, bump the iOS Build and Android `versionCode`, then archive and upload again |
| Legal text | Update `client/src/legal/*`. If the Terms change, update `TERMS_VERSION` in `server/lib/moderation.js` so everyone is asked to accept again, then ship both. |
| App icon or splash | Replace the PNGs in `assets/`, then run `npx capacitor-assets generate --ios --android` and `npx cap sync` |

## Troubleshooting

- **"Network request failed" / nothing loads in the app:** `VITE_API_URL` in `.env.mobile` must be your live `https://` backend. Rebuild with `npm run build:mobile`. Check `https://<backend>/api/health` in Safari on the phone.
- **Camera screen says it needs a secure connection:** you're running a build made without `npm run build:mobile`, or loading the app over `http://`. Capacitor apps are secure contexts, so this shouldn't happen in a proper build.
- **Black camera preview on iOS:** make sure the camera permission is on in iOS Settings → Storytime. iOS 14.5+ is required for in-app camera access inside the app's web view.
- **Android: permission denied without asking:** reset the app's permissions in Android Settings → Apps → Storytime → Permissions.
- **Xcode signing errors:** confirm the Bundle ID matches one registered to your team, and that you're signed in under Xcode → Settings → Accounts.
- **Stale UI after changes:** run `npm run build:mobile` again. The native projects contain a copy of `dist/`, and it doesn't update on its own.
