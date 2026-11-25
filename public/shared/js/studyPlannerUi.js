// Study planner UI — calendar-ish schedule view with today prominent.
// The plan is a projection regenerated from current mastery on every view —
// it is labeled as such, never stored, never edited by hand.
import { generatePlan, planProgress, dayKey, daysBetween, loadExamDates, saveExamDate } from './studyPlanner.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const KIND_LABEL = { quiz: 'Quiz session', flashcards: 'Flashcards', review: 'Review / past-paper' };
const KIND_ICON = { quiz: '✎', flashcards: '▤', review: '⚑' };

export function plannerHtml({ plan, progress, examDate, subject, topicMastery }) {
  const today = dayKey(new Date());
  const rows = progress.perDay.map(d => {
    const isToday = d.date === today;
    const isPast = daysBetween(d.date, today) > 0;
    const sessHtml = d.sessions.map(s => `
      <div style="display:flex; align-items:center; gap:8px; padding:4px 0; font-size:13px; ${s.done ? 'opacity:.55;' : ''}">
        <span style="width:16px; text-align:center;">${s.done ? '✓' : KIND_ICON[s.kind] || '✎'}</span>
        <span style="flex:1; ${s.done ? 'text-decoration:line-through;' : ''}">${esc(s.topic)}</span>
        <span class="mono" style="font-size:10.5px; color:var(--ink-muted);">${KIND_LABEL[s.kind] || s.kind} · ${s.minutes}m${s.round > 1 ? ' · round ' + s.round : ''}</span>
      </div>`).join('');
    if (!d.sessions.length && !isToday) return '';
    const dt = new Date(d.date + 'T12:00:00');
    const label = dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return `
      <div style="border:1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}; border-radius:10px; padding:10px 14px; margin-bottom:8px; ${isToday ? 'background:color-mix(in srgb, var(--accent) 6%, transparent);' : isPast ? 'opacity:.65;' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
          <strong style="font-size:13px;">${esc(label)}</strong>
          ${isToday ? '<span class="pill accent" style="font-size:10.5px;">TODAY</span>' : ''}
        </div>
        ${sessHtml || '<div class="mono" style="font-size:11.5px; color:var(--ink-muted);">rest / buffer day</div>'}
      </div>`;
  }).join('');

  return `
    <div class="card" style="padding:20px 24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:6px;">
        <h2 class="serif" style="font-size:22px;">Revision timetable</h2>
        <label class="mono" style="font-size:12px; color:var(--ink-muted);">exam date
          <input type="date" id="plannerExamDate" value="${esc(examDate || '')}" style="margin-left:6px; padding:5px 8px; background:var(--surface); color:var(--ink); border:1px solid var(--border); border-radius:6px;" />
        </label>
      </div>
      <p class="mono" style="font-size:11px; color:var(--ink-muted); margin-bottom:14px;">
        projection from current mastery — regenerates as you practice, not a contract
        ${progress.total ? ` · ${progress.done}/${progress.total} sessions done` : ''}
      </p>
      ${plan.truncated ? `<p class="mono" style="font-size:11px; color:var(--amber,#c90); margin-bottom:10px;">⚠ timetable over capacity — ${plan.dropped} planned session${plan.dropped === 1 ? '' : 's'} don't fit before the exam; consider more days or fewer topics</p>` : ''}
      ${examDate ? rows || '<p class="mono" style="font-size:12px; color:var(--ink-muted);">No sessions fit before the exam date — is it too soon?</p>'
        : '<p class="mono" style="font-size:12.5px; color:var(--ink-muted);">Set your exam date above and a backwards revision schedule appears here — weakest topics first, spaced repetition interleaved.</p>'}
    </div>`;
}

// mountPlanner(host, {subject, masteryRows, scoreEntries, onStartSession})
// masteryRows: [{topic, mastery, dueInDays}]
export function mountPlanner(host, { subject, masteryRows = [], scoreEntries = [], storage } = {}) {
  const render = () => {
    const dates = loadExamDates(storage);
    const examDate = dates[subject] || '';
    let plan = { days: [] }, progress = { done: 0, total: 0, perDay: [] };
    if (examDate && masteryRows.length) {
      plan = generatePlan({ examDate, topics: masteryRows, startDate: new Date() });
      progress = planProgress(plan, scoreEntries);
    }
    host.innerHTML = plannerHtml({ plan, progress, examDate, subject });
    const inp = host.querySelector('#plannerExamDate');
    if (inp) inp.addEventListener('change', () => {
      saveExamDate(subject, inp.value || null, storage);
      render();
    });
  };
  render();
}

// launchpad today widget: across all subjects with exam dates set.
// subjectData: [{subject, label, masteryRows, scoreEntries, href}]
export function launchpadTodayHtml(subjectData) {
  const today = dayKey(new Date());
  const blocks = [];
  for (const sd of subjectData) {
    const dates = loadExamDates();
    const examDate = dates[sd.subject];
    if (!examDate || !sd.masteryRows.length) continue;
    const plan = generatePlan({ examDate, topics: sd.masteryRows, startDate: new Date() });
    const progress = planProgress(plan, sd.scoreEntries);
    const todayDay = progress.perDay.find(d => d.date === today);
    if (!todayDay || !todayDay.sessions.length) continue;
    const items = todayDay.sessions.map(s => `
      <div style="font-size:12.5px; padding:2px 0; ${s.done ? 'opacity:.5; text-decoration:line-through;' : ''}">
        ${s.done ? '✓' : KIND_ICON[s.kind] || '✎'} ${esc(s.topic)} <span class="mono" style="font-size:10px; opacity:.7;">${s.minutes}m</span>
      </div>`).join('');
    const left = daysBetween(today, examDate);
    blocks.push(`
      <div style="border:1px solid var(--border); border-radius:10px; padding:12px 16px; min-width:200px; flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
          <strong style="font-size:13.5px;">${esc(sd.label)}</strong>
          <span class="mono" style="font-size:10.5px; color:var(--ink-muted);">${left}d to exam</span>
        </div>
        ${items}
        <a href="${esc(sd.href)}" class="mono" style="font-size:11px; color:var(--accent);">open portal →</a>
      </div>`);
  }
  if (!blocks.length) return '';
  return `
    <div class="card" style="padding:16px 20px; margin-bottom:18px;">
      <div class="mono" style="font-size:11px; color:var(--ink-muted); letter-spacing:.07em; text-transform:uppercase; margin-bottom:10px;">Today's revision</div>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">${blocks.join('')}</div>
    </div>`;
}
