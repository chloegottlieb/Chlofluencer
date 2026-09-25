import { Link } from 'react-router-dom';
import { LEGAL } from './config.js';
import { Email, L } from './LegalText.jsx';

export default function TermsOfUse() {
  return (
    <>
      <h1>Terms of Use</h1>
      <p className="muted">Effective {LEGAL.effectiveDate}</p>
      <p>
        These Terms are an agreement between you and <L k="companyName" /> for your use of {LEGAL.appName} (the
        “Service”). By creating an account or using the Service you agree to these Terms, our{' '}
        <Link to="/guidelines">Community Guidelines</Link> and our <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>1. Who can use {LEGAL.appName}</h2>
      <p>
        You must be at least {LEGAL.minimumAge} years old (or older if your country requires it), able to form a binding
        contract, and not barred from using the Service under applicable law. You must not have been previously removed
        from the Service for violating these Terms.
      </p>

      <h2>2. Your account</h2>
      <p>
        Keep your password secure and don't share your account. You're responsible for activity on your account. Don't
        impersonate anyone or pick a username that's offensive or misleading.
      </p>

      <h2>3. No tolerance for objectionable content or abusive users</h2>
      <p>
        <strong>
          There is no tolerance on {LEGAL.appName} for objectionable content or abusive behaviour.
        </strong>{' '}
        You agree not to post, send or share content that is hateful, harassing, threatening, sexually explicit,
        violent, exploitative of children, promotes self-harm, is illegal, infringes someone else's rights, or is spam.
        Our <Link to="/guidelines">Community Guidelines</Link> explain this in detail.
      </p>
      <p>
        You can report any story, account, reply or message from inside the app, and block anyone at any time. We review
        reports within 24 hours. We may filter content automatically, remove content, hide it while we review it, and
        suspend or permanently ban accounts that break these rules, with or without notice.
      </p>

      <h2>4. Your content</h2>
      <p>
        You own the content you post. To run the Service, you give us a worldwide, non-exclusive, royalty-free license to
        host, store, display, reproduce, adapt (for example to resize or compress media) and distribute your content in
        the Service, according to your privacy settings. This includes recommending your public stories to other users
        unless you turn that off. This license ends when you delete the content or your account, except for copies kept
        for the limited time described in our Privacy Policy, or where others have already interacted with it.
      </p>
      <p>You promise that you have the rights to everything you post and that it doesn't break the law or these Terms.</p>

      <h2>5. Using the Service responsibly</h2>
      <ul>
        <li>Don't scrape, spam, or use bots or automated means to access the Service.</li>
        <li>Don't try to break, overload or get around our security, rate limits or moderation.</li>
        <li>Don't sell, buy or transfer accounts, followers or engagement.</li>
        <li>Don't use the Service to break the law or to violate other people's privacy or intellectual property.</li>
      </ul>

      <h2>6. Intellectual property</h2>
      <p>
        The Service, including our name, logo and software, belongs to <L k="companyName" />. If you believe content on
        the Service infringes your copyright, report it in the app (reason: “Intellectual property violation”) or email{' '}
        <Email k="supportEmail" /> with the details required by law.
      </p>

      <h2>7. Ending your use</h2>
      <p>
        You can delete your account at any time in Settings. We may suspend or end your access if you break these Terms,
        if we're required to by law, or to protect our users or the Service.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        The Service is provided “as is” and “as available”. To the extent the law allows, we disclaim all warranties,
        express or implied. We don't control what other users post and aren't responsible for it, although we act on
        reports as described above.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the extent the law allows, <L k="companyName" /> won't be liable for indirect, incidental, special,
        consequential or punitive damages, or for lost profits, data or goodwill. Our total liability for any claim about
        the Service is limited to the greater of USD $100 or the amount you paid us in the past 12 months. Nothing in these
        Terms limits liability that can't be limited by law.
      </p>

      <h2>10. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of <L k="governingLaw" />, except where the law of your country of
        residence requires otherwise. If you're a consumer in the EU or UK, you also benefit from the mandatory
        protections of the law where you live.
      </p>

      <h2>11. Apple App Store and Google Play</h2>
      <p>
        If you downloaded the app from the Apple App Store or Google Play, you also agree to that store's terms. These
        Terms are between you and <L k="companyName" /> only, not Apple or Google, and we alone are responsible for the
        app and its content. Apple and Google have no obligation to provide maintenance or support for the app. If the
        app fails to meet any applicable warranty, you may notify Apple and Apple may refund the purchase price (if any);
        to the extent the law allows, Apple has no other warranty obligation. Apple is not responsible for handling any
        claims about the app, including product liability, legal or regulatory compliance, or intellectual property
        infringement claims. You confirm you're not in a country subject to a U.S. Government embargo and are not on any
        U.S. Government list of prohibited or restricted parties. Apple and its subsidiaries are third-party
        beneficiaries of these Terms and may enforce them against you.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may update these Terms. If the changes are significant, we'll ask you to review and accept them in the app
        before you continue using the Service.
      </p>

      <h2>13. Contact</h2>
      <p>
        <L k="companyName" />, <L k="companyAddress" />. Email: <Email k="supportEmail" />.
      </p>
    </>
  );
}
