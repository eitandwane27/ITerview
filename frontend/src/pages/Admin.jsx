import { useEffect, useRef, useState } from 'react';
import { LogOut, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSchoolAuth } from '../auth/schoolAuth';
import DashboardSignOutDialog from '../components/DashboardSignOutDialog';
import HrTester from '../components/hrTester';
import ResultsHeader from '../components/ResultsHeader';
import { Badge } from '../components/ui/badge';
import adminRequest from '../utils/adminRequest';
import AdminResearchData from './AdminResearchData';
import AdminScoringStudy, { AdminHrRatings } from './AdminScoringStudy';
import './Admin.css';

const adminPages = [
  { id: '', title: 'Students', description: 'Find student accounts, view unlocked tiers, and manage official names.', Content: AdminStudents },
  { id: 'research-data', title: 'Research Data', Content: AdminResearchData },
  { id: 'scoring-study', title: 'Scoring Study', description: 'Run H₀₃ AI trials and compare saved scores for the research study.', Content: AdminScoringStudy },
  { id: 'hr-ratings', title: 'H₀₄ · HR ratings', Content: AdminHrRatings },
  { id: 'hr-tester', title: 'HR Tester', description: 'Generate and copy interview questions for HR review.', Content: HrTester },
];

const unlockedTierLabels = new Map([['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]);

export default function Admin() {
  const { user, logout } = useSchoolAuth();
  const [params] = useSearchParams();
  const activePage = adminPages.find(({ id }) => id === params.get('tab')) ?? adminPages[0];
  const { id, title, description, Content } = activePage;
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError('');
    try {
      await logout({ redirectTo: '/landing' });
    } catch {
      setSignOutError('We couldn’t sign you out. Please try again.');
      setSigningOut(false);
    }
  }

  return (
    <div className="rs-root admin-page">
      <ResultsHeader badge="Admin">
        <button type="button" className="rs-topbar-return-btn" aria-haspopup="dialog" onClick={() => {
          setSignOutError('');
          setConfirmSignOut(true);
        }}>
          <LogOut size={15} aria-hidden="true" />
          Sign out
        </button>
      </ResultsHeader>
      <main className={`rs-main admin-main${id === 'hr-ratings' ? ' admin-main--ratings' : ''}`}>
        <nav className="admin-nav" aria-label="Admin pages">
          {adminPages.map((page) => (
            <Link key={page.id} to={page.id ? `/admin?tab=${page.id}` : '/admin'}
              aria-current={page === activePage ? 'page' : undefined}>
              {page.title}
            </Link>
          ))}
        </nav>
        <div className="rs-header-section">
          <h1 className="rs-page-title">{title}</h1>
          {id === 'research-data' ? (
            <p className="rs-page-subtitle research-run">
              <span><strong>H₀₁</strong> Pre/post interview</span>
              <span><strong>H₀₂</strong> Confidence survey</span>
            </p>
          ) : description && <p className="rs-page-subtitle">{description}</p>}
        </div>
        <Content user={user} />
      </main>
      {confirmSignOut && (
        <DashboardSignOutDialog
          pending={signingOut}
          error={signOutError}
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={handleSignOut}
        />
      )}
    </div>
  );
}

function AdminStudents({ user }) {
  const [roster, setRoster] = useState({ students: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const dialog = useRef(null);
  const editTrigger = useRef(null);
  const searchInput = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    adminRequest(user, '/students', { signal })
      .then(({ students }) => {
        if (!Array.isArray(students)) throw new Error('Could not load students. Please try again.');
        if (!controller.signal.aborted) setRoster({ students, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setRoster({ students: null, error: error.name === 'TimeoutError' ? 'Loading students timed out. Try again.' : error.message });
        }
      });
    return () => controller.abort();
  }, [user, attempt]);

  const query = search.trim().toLowerCase();
  const students = roster.students?.filter((student) =>
    [student.officialName, student.displayName, student.email].some((value) =>
      value?.toLowerCase().includes(query)
    )
  ) ?? [];

  function openEditor(student, event) {
    editTrigger.current = event.currentTarget;
    setEditing(student);
    setName(student.officialName ?? '');
    setSaveError('');
    setNotice('');
    dialog.current.showModal();
  }

  async function saveName(value) {
    if (!editing || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const { student } = await adminRequest(user, `/students/${encodeURIComponent(editing.firebaseUid)}/official-name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officialName: value }),
        signal: AbortSignal.timeout(15000),
      });
      if (!student || student.firebaseUid !== editing.firebaseUid) throw new Error('Could not confirm the saved name. Try again.');
      setRoster(({ students: current }) => ({
        students: current.map((row) => row.firebaseUid === student.firebaseUid ? student : row),
        error: '',
      }));
      setNotice(student.officialName ? 'Official name saved.' : 'Official name cleared.');
      dialog.current?.close();
    } catch (error) {
      setSaveError(error.name === 'TimeoutError' ? 'Saving timed out. Try again.' : error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
        <section className="admin-roster" aria-label="Student roster" aria-busy={!roster.students && !roster.error}>
          <div className="admin-toolbar">
            <label className="admin-search">
              <Search size={17} aria-hidden="true" />
              <input ref={searchInput} type="search" aria-label="Search students by name or email" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <span className="admin-count" role="status">
              {roster.students && `${students.length} ${students.length === 1 ? 'student' : 'students'}`}
            </span>
          </div>
          {notice && <p role="status" className="admin-notice">{notice}</p>}
          {roster.error ? (
            <div className="admin-feedback">
              <p role="alert">{roster.error}</p>
              <button type="button" className="admin-action" onClick={() => {
                setRoster({ students: null, error: '' });
                setAttempt((value) => value + 1);
              }}>Try again</button>
            </div>
          ) : (
            <table className="admin-table admin-students-table" role="table">
              <thead><tr>
                <th scope="col">Official name</th>
                <th scope="col">Display name</th>
                <th scope="col">School email</th>
                <th scope="col">Highest unlocked tier</th>
                <th scope="col">Action</th>
              </tr></thead>
              <tbody>
                {students.map((student) => {
                  const tier = unlockedTierLabels.get(student.unlockedDifficulty) ?? 'Easy';
                  return (
                    <tr key={student.firebaseUid} role="row">
                      <td role="cell"><span className="admin-mobile-label" aria-hidden="true">Official name</span>
                        <span className={student.officialName ? 'admin-official' : 'admin-muted'}>{student.officialName || 'Name not set'}</span>
                      </td>
                      <td role="cell"><span className="admin-mobile-label" aria-hidden="true">Display name</span>{student.displayName || '—'}</td>
                      <td role="cell"><span className="admin-mobile-label" aria-hidden="true">School email</span>{student.email}</td>
                      <td role="cell">
                        <span className="admin-mobile-label" aria-hidden="true">Highest unlocked tier</span>
                        <Badge className="admin-tier" data-tier={tier} variant={tier === 'Easy' ? 'secondary' : 'default'}>
                          {tier}
                        </Badge>
                      </td>
                      <td role="cell"><button type="button" className="admin-action" onClick={(event) => openEditor(student, event)}>
                        {student.officialName ? 'Edit name' : 'Add name'}
                      </button></td>
                    </tr>
                  );
                })}
                {!students.length && (
                  <tr className="admin-table-message"><td colSpan="5">
                    <span role="status">
                      {!roster.students ? 'Loading students…' : query ? 'No students match your search.' : 'No student accounts yet.'}
                    </span>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </section>

      <dialog
        className="admin-dialog"
        ref={dialog}
        aria-labelledby="admin-editor-title"
        onCancel={(event) => { if (saving) event.preventDefault(); }}
        onClose={() => {
          setEditing(null);
          const target = editTrigger.current?.isConnected ? editTrigger.current : searchInput.current;
          target?.focus();
        }}
      >
        <form onSubmit={(event) => { event.preventDefault(); void saveName(name.trim()); }}>
          <h2 id="admin-editor-title">{editing?.officialName ? 'Edit official name' : 'Add official name'}</h2>
          <p className="admin-dialog-account">{editing?.displayName && <strong>{editing.displayName}</strong>}{editing?.email}</p>
          <label className="admin-name-field">
            Official name
            <input type="text" autoFocus autoComplete="off" maxLength={160} value={name} disabled={saving} onChange={(event) => setName(event.target.value)} />
          </label>
          <p className="admin-dialog-hint">Visible to admins only.</p>
          {saveError && <p className="admin-error" role="alert">{saveError}</p>}
          <div className="admin-dialog-actions">
            {editing?.officialName && (
              <button type="button" className="admin-action admin-clear" disabled={saving} onClick={() => void saveName('')}>Clear official name</button>
            )}
            <button type="button" className="rs-btn-secondary" disabled={saving} onClick={() => dialog.current.close()}>Cancel</button>
            <button type="submit" className="rs-btn-primary" disabled={saving || !name.trim() || name.trim() === editing?.officialName}>
              {saving ? 'Saving…' : 'Save name'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
