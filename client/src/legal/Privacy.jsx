import { Link } from 'react-router-dom';
import { LEGAL } from './config.js';
import { Email, L } from './LegalText.jsx';

export default function PrivacyPolicy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="muted">Effective {LEGAL.effectiveDate}</p>
      <p>
        This Privacy Policy explains how <L k="companyName" /> (“we”, “us”) collects, uses and shares information when you
        use {LEGAL.appName}, our mobile apps and website (the “Service”). We don't sell your personal information, and we
        don't use third-party advertising or tracking.
      </p>

      <h2>1. Information we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li><strong>Account details:</strong> username, email address, password (stored only as a secure hash), and optionally your name, bio, website, profile picture and interests.</li>
        <li><strong>Content:</strong> the stories you post (photos, videos, text, captions and tags), highlights, story replies and direct messages.</li>
        <li><strong>Reports:</strong> when you report content or an account, the reason and any details you add.</li>
        <li><strong>Communications:</strong> messages you send to our support team.</li>
      </ul>
      <h3>Information created when you use the Service</h3>
      <ul>
        <li><strong>Activity:</strong> who you follow, block and mute, which stories you view and roughly how much of each you watch, likes, and creators you mark “Not interested”.</li>
        <li><strong>Technical data:</strong> IP address, device and browser type, and server logs, which we use for security, abuse prevention and troubleshooting.</li>
        <li><strong>Settings:</strong> your privacy, discovery, playback, notification and appearance preferences.</li>
      </ul>
      <h3>Camera, microphone and photos</h3>
      <p>
        We only use your camera and microphone while you're using the in-app camera to take a photo or video, and only
        with your permission. We only access photos or videos you choose to share. We never scan your photo library.
      </p>

      <h2>2. How we use information</h2>
      <ul>
        <li>To run the Service: create your account, show your stories to the right people, deliver messages and notifications.</li>
        <li>To personalise <strong>For You</strong>: we recommend stories from people you don't follow based on your chosen interests and what you watch, like and reply to. You can turn personalisation or discovery off in Settings.</li>
        <li>To keep people safe: we review reported content, use automated filters to block certain abusive language, and enforce our <Link to="/guidelines">Community Guidelines</Link>.</li>
        <li>To protect the Service: prevent spam, fraud and unauthorised access, including limiting repeated login attempts.</li>
        <li>To communicate with you about your account, security and changes to our terms.</li>
      </ul>

      <h2>3. How information is shared</h2>
      <ul>
        <li><strong>With other users, based on your settings.</strong> Your username, name, profile picture, bio and highlights are visible to others. Public stories can be seen by anyone and may be recommended in For You unless you turn that off. Private accounts and followers-only stories are only shown to approved followers. Direct messages are only visible to you and the person you're messaging.</li>
        <li><strong>With service providers</strong> who host our servers and store data for us, under contracts that limit their use of your information.</li>
        <li><strong>For safety and legal reasons</strong>, if we believe in good faith it's needed to follow the law, respond to legal process, protect someone's safety, or enforce our terms.</li>
        <li><strong>In a business transfer</strong>, such as a merger or acquisition, subject to this policy.</li>
      </ul>
      <p>We do not sell or rent personal information, and we do not share it for cross-context behavioural advertising.</p>

      <h2>4. How long we keep information</h2>
      <ul>
        <li>Stories disappear from other people's feeds after 24 hours. We keep a private copy in your Archive unless you turn archiving off. Stories you add to highlights stay until you remove them.</li>
        <li>When you delete your account, we delete your profile, stories, highlights, messages, follows and likes from our live systems immediately. Copies in backups are deleted within 30 days.</li>
        <li>We may keep reports and records of moderation decisions for up to 2 years to keep the Service safe and handle appeals, and longer if the law requires it.</li>
      </ul>

      <h2>5. Your choices and rights</h2>
      <ul>
        <li>Edit your profile, change privacy settings, make your account private, or turn off discovery and personalisation in <Link to="/settings">Settings</Link>.</li>
        <li>Delete stories, highlights or your whole account at any time (Settings → Delete account).</li>
        <li>Block, mute or report anyone.</li>
        <li>
          Depending on where you live (for example in the EU/UK under the GDPR, or in California under the CCPA/CPRA),
          you may have the right to access, correct, delete or get a copy of your data, and to object to or limit certain
          processing. To make a request, email <Email k="privacyEmail" />. We'll respond within the time the law requires
          and won't discriminate against you for exercising your rights.
        </li>
      </ul>
      <p>
        <strong>Legal bases (EU/UK):</strong> we process data to perform our contract with you (running the Service), for
        our legitimate interests (safety, security and improving recommendations), with your consent (camera and
        microphone access, which you can withdraw in your device settings), and to comply with legal obligations.
      </p>

      <h2>6. Children</h2>
      <p>
        {LEGAL.appName} is not for children under {LEGAL.minimumAge} (or the minimum age of digital consent where you
        live, if higher). We don't knowingly collect information from children below that age. If you believe a child is
        using the Service, contact <Email k="privacyEmail" /> and we'll delete the account.
      </p>

      <h2>7. Security</h2>
      <p>
        We protect your information with encryption in transit (HTTPS), hashed passwords, access controls and monitoring.
        No system is perfectly secure, so please use a strong, unique password.
      </p>

      <h2>8. International transfers</h2>
      <p>
        We may process information in countries other than the one you live in. When we transfer personal data out of
        the EU/UK, we use appropriate safeguards such as Standard Contractual Clauses.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        If we make material changes, we'll let you know in the app before they take effect. The date at the top shows
        when this policy last changed.
      </p>

      <h2>10. Contact us</h2>
      <p>
        <L k="companyName" />
        <br />
        <L k="companyAddress" />
        <br />
        Email: <Email k="privacyEmail" />
      </p>
    </>
  );
}
