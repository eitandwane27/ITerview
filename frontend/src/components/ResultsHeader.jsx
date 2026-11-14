import logoSrc from '../assets/logo';
import '../pages/Results.css';

export default function ResultsHeader({ badge, practice = false, children }) {
  return (
    <header className="rs-topbar">
      <div className="rs-topbar-inner">
        <div className="rs-topbar-left">
          <div className="rs-topbar-brand">
            <img src={logoSrc} alt="" className="rs-topbar-logo" />
            <span>ITerview</span>
          </div>
          {badge && (
            <span className={`rs-topbar-mode-badge${practice ? ' rs-topbar-mode-badge--practice' : ''}`}>
              {badge}
            </span>
          )}
        </div>
        {children && <div className="rs-topbar-right">{children}</div>}
      </div>
    </header>
  );
}
