import { Link, useNavigate } from 'react-router-dom';
import CommunityGuidelines from '../legal/Guidelines.jsx';
import PrivacyPolicy from '../legal/Privacy.jsx';
import TermsOfUse from '../legal/Terms.jsx';
import AccountDeletion from '../legal/AccountDeletion.jsx';

const DOCS = { privacy: PrivacyPolicy, terms: TermsOfUse, guidelines: CommunityGuidelines, 'delete-account': AccountDeletion };

/** Public legal pages (reachable without an account, e.g. from the App Store listing). */
export default function Legal({ doc }) {
  const navigate = useNavigate();
  const Doc = DOCS[doc];
  return (
    <div className="page legal-page">
      <header className="top-bar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>‹</button>
        <nav className="legal-nav small-text">
          <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/guidelines">Guidelines</Link>
        </nav>
        <span />
      </header>
      <article className="legal">
        <Doc />
      </article>
    </div>
  );
}
