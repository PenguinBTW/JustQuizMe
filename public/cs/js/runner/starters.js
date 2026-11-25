// Computer Science Quiz Run Starters
import { S, MIXED_UUID, OCR_TOPIC_SPECS } from '../state.js';
import { api } from '../api.js';
import { orderTypeShuffled } from '../utils.js';
import { mixedPool, pickForMode } from '../taxonomy.js';
import { beginRun } from './assessment.js';
import { createSeries } from '../../../shared/js/mockSeries.js';
import { pickCurrentSave } from '../../../shared/js/saveSelection.js';

// Exam pace → minutes per mark. null = untimed (opt-out of time pressure).
export function paceMinutesPerMark(pace) {
  const map = { untimed: null, relaxed: 1.5, standard: 1.07, strict: 0.9 };
  return pace in map ? map[pace] : 1.07;
}

export function startMixedRun(exam) {
  const pool = mixedPool();
  if (!pool.length) return alert('No questions found in chosen topics.');
  const { set, tot } = pickForMode(pool, S.mixed.mode, S.mixed.m);
  if (!set.length) return;
  beginRun({
    mode: exam ? 'exam' : 'quiz',
    quizLike: {
      uuid: MIXED_UUID,
      version: 1,
      title: `Synthesized Paper · ${tot}m (${set.length}Q)`,
      timeLimitMinutes: exam && paceMinutesPerMark(S.mixed.pace) != null
        ? Math.max(5, Math.round(tot * paceMinutesPerMark(S.mixed.pace)))
        : null,
      untimed: paceMinutesPerMark(S.mixed.pace) == null,
      exam: !!exam,
      questions: set
    },
    meta: { category: 'normal', file: 'synthesized', virtual: true }
  });
}

export function startSubQuiz(topic, sub) {
  beginRun({
    mode: 'quiz',
    quizLike: {
      uuid: MIXED_UUID,
      version: 1,
      title: `${topic} · ${sub.name}`,
      timeLimitMinutes: null,
      questions: orderTypeShuffled(sub.questions)
    },
    meta: { category: 'normal', file: 'subtopic', virtual: true }
  });
}

// Mock exam series — component papers back-to-back under fatigue. Builds one
// paper per component (Comp 01 / Comp 02) from that component's full topic
// pool, then runs them in sequence as exams. Series state lives in S.series
// and is threaded through the save blob for reload-safety.
export async function startMockSeries({ breakMinutes = 10 } = {}) {
  const data = S._topicData || [];
  const papers = [];
  const sets = [];
  const usedKeys = new Set();
  const keyOf = q => q._key || (q._srcFile ? q._srcFile + ':' + q.id : null) || q.id || q.uuid || q.prompt;
  const normT = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const compOf = {};
  try { (OCR_TOPIC_SPECS || []).forEach(sp => { compOf[normT(sp.topic)] = sp.component; }); } catch {}
  // compute both component pools up front so shared questions are visible:
  // a bank spanning both components copies its questions into every tagged
  // topic — a question belongs on a paper only when its OWN topic maps to it
  const poolsByComp = {};
  for (const comp of ['01', '02']) {
    const compTopics = data.filter(t => t.component === comp);
    const rawPool = compTopics.flatMap(t => (t.subs || []).flatMap(g => (g.questions || []).map(q => ({ ...q, _topic: q.topic || t.topic, _sub: g.name }))))
      .filter(q => !q.topic || !compOf[normT(q.topic)] || compOf[normT(q.topic)] === comp);
    const seen = new Set();
    poolsByComp[comp] = rawPool.filter(q => { const k = keyOf(q); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  // pool reservation: questions shared by both components must not be
  // consumable wholesale by component 01 — reserve a minimum share for the
  // later paper, because a series that cannot run comp02 fails its purpose
  const keys01 = new Set((poolsByComp['01'] || []).map(keyOf));
  const sharedKeys = [...new Set((poolsByComp['02'] || []).map(keyOf).filter(k => keys01.has(k)))];
  const reserve = Math.min(3, Math.max(0, Math.floor(sharedKeys.length / 2)));
  const reservedKeys = new Set(sharedKeys.slice(0, reserve));
  for (const comp of ['01', '02']) {
    const basePool = poolsByComp[comp] || [];
    // cross-paper exclusion uses what earlier papers actually SELECTED, not
    // their whole pool — and comp01 additionally stays out of the reserve
    const seen = new Set(usedKeys);
    const pool = basePool.filter(q => {
      const k = keyOf(q);
      if (seen.has(k)) return false;
      if (comp === '01' && reservedKeys.has(k) && basePool.length - reserve >= 4) return false;
      seen.add(k);
      return true;
    });
    if (!pool.length) continue;
    const poolMarks = pool.reduce((x, q) => x + (+q.marks || 0), 0);
    const target = Math.max(10, Math.min(70, poolMarks));
    const { set, tot } = pickForMode(pool, 'standard', target);
    if (!set.length) continue;
    set.forEach(q => usedKeys.add(q._key || (q._srcFile ? q._srcFile + ':' + q.id : null) || q.id || q.uuid || q.prompt));
    const pace = paceMinutesPerMark(S.mixed.pace);
    papers.push({
      key: `comp${comp}`,
      title: `Mock · Component ${comp} (${tot} marks)`,
      totalMarks: tot,
      timeLimitMinutes: pace == null ? null : Math.max(5, Math.round(tot * pace)),
    });
    sets.push(set);
  }
  if (papers.length < 2) {
    // honest assembly: if components aren't tagged, split the full pool in half
    const allRaw = data.flatMap(t => (t.subs || []).flatMap(g => (g.questions || []).map(q => ({ ...q, _topic: q.topic || t.topic, _sub: g.name }))));
    // multi-tagged questions repeat across topics — dedupe by id so one
    // question can't land in both papers or score twice within one
    const seen = new Set();
    const all = allRaw.filter(q => { const k = q._key || (q._srcFile ? q._srcFile + ":" + q.id : null) || q.id || q.uuid || JSON.stringify(q).length + q.prompt; if (seen.has(k)) return false; seen.add(k); return true; });
    if (all.length < 8) return alert('Not enough questions in the bank to assemble a mock series.');
    const half = Math.floor(all.length / 2);
    const poolMarks = all.reduce((x, q) => x + (+q.marks || 0), 0);
    const target = Math.max(10, Math.min(50, Math.round(poolMarks / 2)));
    const pace = paceMinutesPerMark(S.mixed.pace);
    papers.length = 0; sets.length = 0;
    for (const [i, label] of [[0, 'Paper 1'], [1, 'Paper 2']]) {
      const { set, tot } = pickForMode(all.slice(i * half, (i + 1) * half), 'standard', target);
      if (!set.length) continue;
      papers.push({ key: `paper${i + 1}`, title: `Mock · ${label} (${tot} marks)`, totalMarks: tot, timeLimitMinutes: pace == null ? null : Math.max(5, Math.round(tot * pace)) });
      sets.push(set);
    }
  }
  if (papers.length < 2) return alert('Could not assemble two component papers.');
  // a series checkpoint shares the single save slot with ordinary quizzes —
  // preserve any in-progress save inside the series so it can be restored
  // when the series completes; warn before displacing it.
  // the server is the source of truth for saves — S.save can lag behind
  // auto-saved progress, and capturing stale answers here would restore them
  // over newer work when the series ends
  let freshSave = S.save;
  let remoteKnown = false;
  try { const remote = await api('/api/save'); freshSave = remote || null; remoteKnown = true; } catch {}
  // when the server answers, it is authoritative — an empty slot means the
  // save was discarded (possibly in another tab) and the stale cached copy
  // must NOT resurrect it. The cache is a fallback only for network failure.
  const curSave = pickCurrentSave(freshSave, remoteKnown, S.save);
  const priorSeries = curSave && curSave.seriesContinuation ? (curSave.series || null) : null;
  const inherited = priorSeries && priorSeries.displacedSave ? priorSeries.displacedSave : null;
  if (curSave && !curSave.seriesContinuation) {
    const t = (curSave && curSave.title) || 'untitled session';
    // a displaced TIMED exam's deadline honestly keeps running while the series
    // is sat — the student must know before they trade their remaining time
    const clockNote = (curSave.exam && curSave.timeLimitMinutes) ? ' Its exam clock keeps running while you sit the series.' : '';
    if (!confirm('Starting this mock series will pause your saved session "' + t + '" — it is restored automatically when the series finishes.' + clockNote + ' Continue?')) return;
  }
  const series = createSeries(papers, { breakMinutes });
  // a replacement series inherits the displaced quiz from the checkpoint it
  // replaces — otherwise the paused session is lost without warning
  series.displacedSave = (curSave && !curSave.seriesContinuation) ? JSON.parse(JSON.stringify(curSave)) : (inherited ? JSON.parse(JSON.stringify(inherited)) : null);
  series._sets = sets; // in-memory question sets; serialized into saves
  S.series = series;
  beginSeriesPaper();
}

export function beginSeriesPaper() {
  const series = S.series;
  if (!series) return;
  const i = series.index;
  const paper = series.papers[i];
  const set = series._sets[i];
  if (!paper || !set) return;
  beginRun({
    mode: 'exam',
    seriesRun: true,
    quizLike: {
      uuid: MIXED_UUID,
      version: 1,
      title: paper.title,
      timeLimitMinutes: paper.timeLimitMinutes,
      untimed: paper.timeLimitMinutes == null,
      exam: true,
      questions: set,
    },
    meta: { category: 'past-paper', file: 'series', virtual: true },
  });
}
