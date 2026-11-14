import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import adminRequest from '../utils/adminRequest';

function hasPair(before, after) {
  return Number.isFinite(before) && Number.isFinite(after);
}

function researchExportRows(participants) {
  return participants.map(({ participantId, preTest, postTest, preLikert, postLikert }) => [
    participantId, preTest.percentage, postTest.percentage,
    preTest.clarity, postTest.clarity, preTest.correctness, postTest.correctness,
    preTest.completeness, postTest.completeness, preLikert, postLikert,
  ]);
}

function exportResearchCsv(participants) {
  const columns = [
    'participant_id', 'pre_test_percent', 'post_test_percent',
    'pre_clarity', 'post_clarity', 'pre_correctness', 'post_correctness',
    'pre_completeness', 'post_completeness', 'pre_likert_total', 'post_likert_total',
  ];
  const csv = [columns, ...researchExportRows(participants)].map((row) => row.join(',')).join('\r\n') + '\r\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'iterview-research-data.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportResearchPdf(participants) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'pt', putOnlyUsedFonts: true });
  const title = 'ITerview Research Data';
  const { width, height } = doc.internal.pageSize;
  const margin = 40;
  const idWidth = 90;
  const scoreWidth = (width - 2 * margin - idWidth) / 10;
  const ink = '#0f172a';
  const muted = '#475569';
  const border = '#e2e8f0';
  const formatScore = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
  const groups = ['Interview score (%)', 'Clarity (/5)', 'Correctness (/5)', 'Completeness (/5)', 'Likert total (/25)'];

  doc.setProperties({ title });
  autoTable(doc, {
    head: [
      [{ content: 'Participant ID', rowSpan: 2 }, ...groups.map((content) => ({ content, colSpan: 2 }))],
      groups.flatMap(() => ['Pre', 'Post']),
    ],
    body: researchExportRows(participants).map(([id, ...scores]) => [
      id, ...scores.map((score) => score == null ? '' : formatScore.format(score)),
    ]),
    margin: { top: 98, right: margin, bottom: 56, left: margin },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      fontSize: 10, cellPadding: { vertical: 7, horizontal: 10 }, valign: 'middle',
      halign: 'center', textColor: ink, lineColor: border, lineWidth: { bottom: 0.5 },
    },
    headStyles: { fillColor: '#eff6ff', textColor: '#1e3a8a' },
    alternateRowStyles: { fillColor: '#f8fafc' },
    didParseCell: ({ cell, column, row, section }) => {
      if (column.index === 0) {
        cell.styles.cellWidth = idWidth;
        cell.styles.halign = 'left';
        cell.styles.fontStyle = 'bold';
      } else {
        cell.styles.cellWidth = scoreWidth;
        if (column.index % 2 === 1) cell.styles.lineWidth = { left: 0.5, bottom: 0.5 };
      }
      if (section === 'head' && row.index === 1) {
        cell.styles.fillColor = '#f8fafc';
        cell.styles.textColor = muted;
        cell.styles.fontSize = 9;
      }
    },
  });
  const pageCount = doc.getNumberOfPages();
  const cohortLabel = `${participants.length} ${participants.length === 1 ? 'participant' : 'participants'}`;
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'bold').setTextColor(ink).setFontSize(23).text(title, margin, 51);
    doc.setFont('helvetica', 'normal').setTextColor(muted).setFontSize(10);
    doc.text('First research run', margin, 73);
    doc.text(cohortLabel, width - margin, 73, { align: 'right' });
    doc.setDrawColor(border).setLineWidth(0.5).line(margin, height - 43, width - margin, height - 43);
    doc.setFontSize(9).text('Blank cells indicate unavailable scores.', margin, height - 27);
    doc.text(`Page ${page} of ${pageCount}`, width - margin, height - 27, { align: 'right' });
  }
  doc.save('iterview-research-data.pdf');
}

function PairStatus({ label, ready }) {
  return (
    <td role="cell">
      <span className="admin-mobile-label" aria-hidden="true">{label}</span>
      <span className={ready ? 'research-ready' : 'admin-muted'}>{ready ? 'Ready' : 'Pending'}</span>
    </td>
  );
}

function MetricRow({ title, before, after, likert = false }) {
  const digits = likert ? 1 : 2;
  const format = (value) => likert ? value.toFixed(digits) : String(Number(value.toFixed(digits)));
  const delta = hasPair(before, after) ? Number((Number(format(after)) - Number(format(before))).toFixed(digits)) : null;
  const suffix = likert ? ' / 5' : '%';
  const outcome = delta > 0 ? 'Improved' : delta < 0 ? 'Lower' : 'No change';

  return (
    <tr>
      <th scope="row">{title}</th>
      {[before, after].map((value, index) => (
        <td key={index} className={value == null ? 'admin-muted' : undefined}>
          {value == null ? 'Pending' : `${format(value)}${suffix}`}
        </td>
      ))}
      <td>
        {delta === null ? <span className="admin-muted">—</span> : (
          <>
            {delta > 0 ? '+' : ''}{format(delta)}{likert ? '' : ' pp'}
            <span className={`research-outcome ${delta > 0 ? 'research-ready' : delta < 0 ? 'research-lower' : 'admin-muted'}`}>
              {outcome}
            </span>
          </>
        )}
      </td>
    </tr>
  );
}

export default function AdminResearchData({ user }) {
  const [result, setResult] = useState({ participants: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const dialog = useRef(null);
  const trigger = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    adminRequest(user, '/research-data', { signal })
      .then(({ participants }) => {
        if (!Array.isArray(participants)) throw new Error('Could not load research data. Please try again.');
        if (!controller.signal.aborted) setResult({ participants, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({ participants: null, error: error.name === 'TimeoutError' ? 'Loading research data timed out. Try again.' : error.message });
        }
      });
    return () => controller.abort();
  }, [user, attempt]);

  const participants = result.participants ?? [];
  const hasMissingId = participants.some(({ participantId }) => participantId == null);
  const testReady = participants.filter(({ preTest, postTest }) => hasPair(preTest.percentage, postTest.percentage)).length;
  const likertReady = participants.filter(({ preLikert, postLikert }) => hasPair(preLikert, postLikert)).length;

  async function downloadPdf() {
    setExportingPdf(true);
    setPdfError('');
    try {
      await exportResearchPdf(participants);
    } catch {
      setPdfError('Could not export the PDF. Try again.');
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <>
      <section className="admin-roster" aria-label="Research participants" aria-busy={!result.participants && !result.error}>
        <div className="admin-toolbar research-toolbar">
          <p className="admin-count" role="status">
            {result.participants && (
              <>Pre/Post Test: {testReady} of {participants.length} ready · Likert Scale: {likertReady} of {participants.length} ready</>
            )}
          </p>
          <div className="research-export-actions">
            <button type="button" className="rs-btn-secondary research-export" disabled={!participants.length || hasMissingId} onClick={() => exportResearchCsv(participants)}>
              Export CSV
            </button>
            <button type="button" className="rs-btn-secondary research-export" disabled={!participants.length || hasMissingId || exportingPdf} onClick={downloadPdf}>
              {exportingPdf ? 'Exporting PDF…' : 'Export PDF'}
            </button>
          </div>
        </div>
        {hasMissingId && <div className="admin-feedback"><p role="alert">Every participant needs a four-digit ID to export. Check the school emails for rows marked Missing.</p></div>}
        {pdfError && <div className="admin-feedback"><p role="alert">{pdfError}</p></div>}
        {result.error ? (
          <div className="admin-feedback">
            <p role="alert">{result.error}</p>
            <button type="button" className="admin-action" onClick={() => {
              setResult({ participants: null, error: '' });
              setAttempt((value) => value + 1);
            }}>Try again</button>
          </div>
        ) : (
          <table className="admin-table research-table" role="table">
            <thead><tr>
              <th scope="col">Participant ID</th>
              <th scope="col">School email</th>
              <th scope="col">Pre/Post Test</th>
              <th scope="col">Likert Scale</th>
              <th scope="col">Action</th>
            </tr></thead>
            <tbody>
              {participants.map((participant, index) => (
                <tr key={`${participant.email}:${index}`} role="row">
                  <td role="cell" className="admin-official">{participant.participantId ?? 'Missing'}</td>
                  <td role="cell">{participant.email}</td>
                  <PairStatus label="Pre/Post Test" ready={hasPair(participant.preTest.percentage, participant.postTest.percentage)} />
                  <PairStatus label="Likert Scale" ready={hasPair(participant.preLikert, participant.postLikert)} />
                  <td role="cell"><button type="button" className="admin-action" onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setSelected(participant);
                    dialog.current.showModal();
                  }}>View metrics</button></td>
                </tr>
              ))}
              {!participants.length && <tr className="admin-table-message"><td colSpan="5">
                <span role="status">{result.participants ? 'No research participants yet.' : 'Loading research data…'}</span>
              </td></tr>}
            </tbody>
          </table>
        )}
      </section>

      <dialog className="admin-dialog research-dialog" ref={dialog} aria-labelledby="research-dialog-title" aria-describedby="research-dialog-participant" onClose={() => {
        setSelected(null);
        trigger.current?.focus();
      }}>
        <button type="button" className="research-close" autoFocus aria-label="Close metrics" onClick={() => dialog.current.close()}>
          <X size={22} aria-hidden="true" />
        </button>
        <h2 id="research-dialog-title">Participant metrics</h2>
        <p id="research-dialog-participant">{selected?.participantId ?? selected?.email} · First research run</p>
        {selected && <table className="research-metrics" aria-label="Before and after scores">
          <thead><tr><td /><th scope="col">Before</th><th scope="col">After</th><th scope="col">Change</th></tr></thead>
          <tbody>
            <MetricRow title="Pre/Post Test" before={selected.preTest.percentage} after={selected.postTest.percentage} />
            <MetricRow title="Likert Scale" before={selected.preLikert == null ? null : selected.preLikert / 5} after={selected.postLikert == null ? null : selected.postLikert / 5} likert />
          </tbody>
        </table>}
        <p className="research-unit">pp = percentage points</p>
      </dialog>
    </>
  );
}
