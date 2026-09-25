import { Link } from 'react-router-dom';
import { LEGAL } from './config.js';
import { Email } from './LegalText.jsx';

/** Public page required by Google Play: how to delete your account and data. */
export default function AccountDeletion() {
  return (
    <>
      <h1>Delete your {LEGAL.appName} account</h1>
      <p>You can delete your account and data at any time. There's no waiting period.</p>

      <h2>In the app or on the web</h2>
      <ol>
        <li>Log in to {LEGAL.appName} (in the app, or on this website).</li>
        <li>Go to <Link to="/settings">Settings</Link> and scroll to the bottom.</li>
        <li>Tap <strong>Delete account</strong>, enter your password and confirm.</li>
      </ol>

      <h2>Can't log in?</h2>
      <p>
        Email <Email k="privacyEmail" /> from the address on your account with the subject “Delete my account”. We'll
        confirm it's you and delete the account within 30 days.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your profile (username, name, bio, profile picture, interests) and settings.</li>
        <li>All your stories, highlights and archive, including photos and videos.</li>
        <li>Your direct messages, story replies, likes, follows, blocks and mutes.</li>
      </ul>
      <p>
        Deletion from our live systems is immediate. Backup copies are removed within 30 days. Reports you made, and
        records of moderation decisions about your account, may be kept for up to 2 years for safety and legal reasons,
        as described in our <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </>
  );
}
