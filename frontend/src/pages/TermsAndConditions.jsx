import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import logoImg from '../assets/logo';
import '../components/AuthModal.css';
import './TermsAndConditions.css';

export default function TermsAndConditions() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Terms and Conditions | ITerview';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="am-page-root tc-page">
      <header className="am-topbar">
        <div className="am-topbar-inner">
          <Link to="/landing" className="am-logo-group" aria-label="ITerview home">
            <img src={logoImg} alt="" className="am-logo-img" />
            <span className="am-logo-text">ITerview</span>
          </Link>
          <Link to="/landing" className="am-back-link tc-home-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="tc-content" id="main-content">
        <h1>Terms and Conditions</h1>
        <p className="tc-updated">
          Last updated: <time dateTime="2026-10-22">October 22, 2026</time>
        </p>
        <p>
          These terms describe your use of ITerview, an interview practice and AI coaching system.
          Please read them before creating an account.
        </p>

        <h2>Your account</h2>
        <p>
          Use your own SPCBA school email and verify it before accessing interview sessions. Keep
          your password private and do not share your account or use another person’s account.
        </p>

        <h2>Responsible use</h2>
        <p>
          Use ITerview for learning and interview preparation. Submit your own practice answers. Do
          not impersonate others, access their records, upload harmful content, or disrupt the
          system. Avoid including confidential information or other people’s personal details in
          your answers and messages.
        </p>

        <h2>Practice and AI feedback</h2>
        <p>
          Questions, scores, role suggestions, and coaching are learning aids. AI feedback can be
          incomplete or incorrect. Review it critically and verify technical advice. Practice
          results do not guarantee interview success, employment, or professional certification.
        </p>

        <h2>Microphone and practice information</h2>
        <p>
          Voice practice requires microphone permission. Spoken answers are processed for
          transcription and feedback. ITerview saves assessment answers, scores, and progress to
          support your learning journey. Audio, answers, and coaching messages may be processed by
          external speech and AI services to provide these features.
        </p>

        <h2>Availability and questions</h2>
        <p>
          Features may change or be temporarily unavailable. If you have questions about these
          terms, ask the ITerview project team before creating an account. If you do not agree, do
          not create an account.
        </p>

        <footer className="tc-footer">
          <p>
            Already filling out the signup form? Return to your original tab to continue. Your
            entered details stay there.
          </p>
          <Link to="/register">Go to registration</Link>
        </footer>
      </main>
    </div>
  );
}
