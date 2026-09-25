import { Link } from 'react-router-dom';
import { LEGAL } from './config.js';
import { Email } from './LegalText.jsx';

export default function CommunityGuidelines() {
  return (
    <>
      <h1>Community Guidelines</h1>
      <p className="muted">Effective {LEGAL.effectiveDate}</p>
      <p>
        {LEGAL.appName} is for sharing everyday moments and finding new creators. To keep it fun and safe for everyone,
        these rules apply to stories, highlights, profiles, replies and direct messages. <strong>We have no tolerance
        for objectionable content or abusive users.</strong>
      </p>

      <h2>Don't post or send</h2>
      <ul>
        <li><strong>Hate:</strong> attacks or slurs based on race, ethnicity, national origin, religion, caste, sexual orientation, sex, gender identity, disability or serious disease.</li>
        <li><strong>Bullying and harassment:</strong> threats, degrading content, unwanted sexual comments, or encouraging others to target someone.</li>
        <li><strong>Violence:</strong> credible threats, glorifying violence, graphic gore, or support for dangerous organisations.</li>
        <li><strong>Nudity and sexual content:</strong> sexually explicit material or sexual solicitation.</li>
        <li><strong>Child safety:</strong> any sexualisation or endangerment of minors. We report child sexual exploitation to the authorities.</li>
        <li><strong>Self-harm:</strong> content that encourages or glorifies suicide, self-injury or eating disorders. Talking about recovery is welcome.</li>
        <li><strong>Illegal activity:</strong> selling drugs, weapons or other regulated goods, or promoting fraud.</li>
        <li><strong>Spam and scams:</strong> fake engagement, misleading links, repetitive posting, or buying and selling followers.</li>
        <li><strong>Impersonation:</strong> pretending to be another person or brand.</li>
        <li><strong>Other people's content or private info:</strong> posting copyrighted work you don't have rights to, or sharing private information about others without consent.</li>
      </ul>

      <h2>Sensitive but allowed</h2>
      <p>
        Some content is fine but not for everyone, such as medical content or intense but non-graphic news footage.
        Mark it as <strong>Sensitive content</strong> when you post. People who filter sensitive content won't see it.
      </p>

      <h2>How we enforce these rules</h2>
      <ul>
        <li>Automated filters block certain slurs and abusive phrases before they're posted.</li>
        <li>Anyone can report a story, account, reply or message. Reports are anonymous and reviewed by our team within 24 hours.</li>
        <li>Stories reported by several people are hidden while we review them.</li>
        <li>We may remove content, suspend accounts, or permanently ban people who break these rules, especially for serious or repeated violations.</li>
        <li>If we remove your content, we'll tell you in Activity. If you think we got it wrong, email <Email k="supportEmail" />.</li>
      </ul>

      <h2>Look after yourself and each other</h2>
      <p>
        You can block, mute, restrict replies, or make your account private at any time in <Link to="/settings">Settings</Link>.
        If you or someone you know is in immediate danger, contact local emergency services. If you're struggling,
        please reach out to a local crisis line. In the US you can call or text 988.
      </p>
    </>
  );
}
