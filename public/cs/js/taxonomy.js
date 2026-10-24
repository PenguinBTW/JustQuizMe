// Computer Science Specification Taxonomy & Knapsack Picker
import { S, OCR_TOPIC_SPECS } from './state.js';
import { api } from './api.js';
import { normT, stampPool, shuffle, orderTypeShuffled, esc, formatPrompt, tableHtml, imgSrc, qImages, ak } from './utils.js';

export async function ensurePastFull() {
  for (const cat of ['normal', 'past-paper']) {
    for (const m of (S.quizzes[cat] || [])) {
      if (!S.pastFull[m.file]) {
        try {
          S.pastFull[m.file] = await api(`/api/quiz?category=${cat}&file=${encodeURIComponent(m.file)}`);
        } catch {}
      }
    }
  }

  const all = {};
  for (const cat of ['normal', 'past-paper']) {
    for (const m of (S.quizzes[cat] || [])) {
      const quiz = S.pastFull[m.file];
      if (!quiz) continue;
      for (const q of stampPool(quiz, m.file)) all[q._key] = q;
    }
  }
  S._pastAll = all;
}

export function topicData() {
  return OCR_TOPIC_SPECS.map(spec => {
    const topic = spec.topic;
    const subs = new Map();
    let quizCount = 0;
    const allFiles = S.quizzes['past-paper'] || [];

    for (const m of allFiles) {
      const quiz = S.pastFull[m.file];
      if (!quiz) continue;
      if (!(quiz.topics || []).some(t => normT(t) === normT(topic))) continue;
      quizCount++;
      for (const q of (quiz.questions || [])) {
        const name = (q.subtopic || 'General').trim() || 'General';
        if (!subs.has(name)) subs.set(name, { name, questions: [], srcs: [] });
        const g = subs.get(name);
        g.questions.push({ ...q, _key: `${m.file.replace(/\.json$/i, '')}:${q.id}`, _imgBase: quiz.imageFolder || '', _src: quiz.title, _srcFile: m.file });
        if (!g.srcs.find(s => s.file === m.file)) g.srcs.push({ file: m.file, title: quiz.title });
      }
    }

    // Inspect interactive formats for each subtopic
    for (const g of subs.values()) {
      const types = new Set(g.questions.map(q => q.type));
      g.formatTags = [];
      if (types.has('code-requirement')) g.formatTags.push({ cls: 'tag-code', label: '💻 Code' });
      if (types.has('lmc')) g.formatTags.push({ cls: 'tag-lmc', label: '⚙️ LMC' });
      if (types.has('trace-table')) g.formatTags.push({ cls: 'tag-trace', label: '☷ Trace' });
      if (types.has('truth-table')) g.formatTags.push({ cls: 'tag-logic', label: '⚡ Logic' });
      if (types.has('calculation')) g.formatTags.push({ cls: 'tag-binary', label: '🔢 Binary' });
      if (types.has('extended-response')) g.formatTags.push({ cls: 'tag-essay', label: '📝 Essay' });
    }

    const qcount = [...subs.values()].reduce((s, g) => s + g.questions.length, 0);
    const mmarks = [...subs.values()].reduce((s, g) => s + g.questions.reduce((a, q) => a + (+q.marks || 0), 0), 0);
    return { ...spec, topic, quizCount, qcount, mmarks, subs: [...subs.values()] };
  });
}

export function buildCaches() {
  const data = topicData();
  S._topicData = data;
  S._subCache = new Map();
  data.forEach(t => t.subs.forEach((g, gi) => S._subCache.set(`${t.topic}|${gi}`, { topic: t.topic, sub: g })));
  data.forEach((t, ti) => S._topicCache.set('t' + ti, { t, all: topicAllQs(t) }));
}

export function topicAllQs(t) {
  return t.subs.flatMap(g => g.questions.map(q => ({ ...q, _sub: g.name })));
}

export function topicDraft(topic, mmarks) {
  const d = S.topicDrafts[topic] ||= { marks: Math.min(20, Math.max(1, mmarks)), mode: 'standard' };
  d.marks = Math.max(1, Math.min(mmarks, d.marks));
  return d;
}

export function pickExact(pool, target) {
  target = Math.max(1, Math.round(target));
  const dp = Array(target + 1).fill(null);
  dp[0] = [];
  for (const q of pool) {
    const m = +q.marks || 0;
    if (m <= 0 || m > target) continue;
    for (let s = target - m; s >= 0; s--) {
      if (dp[s] && !dp[s + m]) dp[s + m] = [...dp[s], q];
    }
  }
  for (let s = target; s >= 0; s--) {
    if (dp[s] && dp[s].length) return { set: dp[s], tot: s };
  }
  return { set: pool.length ? [pool[0]] : [], tot: pool.length ? (+pool[0].marks || 0) : 0 };
}

export function pickForMode(pool, mode, target) {
  const shuffled = shuffle(pool);
  const { set, tot } = pickExact(shuffled, target);
  return { set: mode === 'random' ? shuffle(set) : orderTypeShuffled(set), tot };
}

export function mixedPool() {
  const out = [];
  const seen = new Set();
  const cache = S._subCache || new Map();
  for (const key of S.mixed.subs) {
    const c = cache.get(key);
    if (!c || !S.mixed.topics.has(c.topic)) continue;
    for (const q of c.sub.questions) {
      const k = q._key || q.id;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ ...q, _sub: c.sub.name, _topic: c.topic });
    }
  }
  return out;
}

export function getAllQuestionPool() {
  const pool = [];
  const visited = new Set();
  const add = (q) => {
    if (q && q.id && !visited.has(q.id)) {
      visited.add(q.id);
      pool.push(q);
    }
  };
  for (const f in S.pastFull) {
    (S.pastFull[f]?.questions || []).forEach(add);
  }
  (S.quiz?.questions || []).forEach(add);
  return pool;
}

export function normalizeDeps(deps) {
  if (!Array.isArray(deps)) return [];
  return deps.map(d => typeof d === 'string' ? { id: d, showAnswer: false } : { id: d.id, showAnswer: !!d.showAnswer }).filter(d => d.id);
}

export function depAnswerData(src) {
  if (!src) return null;
  if (src.type === 'calculation') {
    return { label: 'Answer', text: String(src.answer ?? '') };
  }
  if (src.type === 'multiple-choice') {
    const o = src.options?.[src.correctIndex];
    return { label: 'Answer', text: typeof o === 'string' ? o : (o?.text || '') };
  }
  if (src.type === 'written') {
    return { label: 'Mark scheme', points: (src.markScheme || []).map(m => m.text) };
  }
  if (src.type === 'extended-response') {
    return { label: 'Indicative content', points: (src.indicativeContent || []).map(p => typeof p === 'string' ? p : (p.text || '')) };
  }
  if (src.type === 'code-requirement') {
    return { label: 'Solution reference', text: src.solutionCode || src.starterCode?.ocr || '' };
  }
  if (src.type === 'self-marked') {
    return {
      label: 'Answer',
      text: src.answerText || '',
      image: src.answerImage ? imgSrc(src.answerImage, src._imgBase) : null,
      alt: src.answerAlt || ('Answer diagram for ' + src.id)
    };
  }
  return null;
}

export function resolveDeps(questions, pool) {
  const byId = new Map();
  for (const q of pool) {
    if (q?.id && !byId.has(q.id)) byId.set(q.id, q);
  }
  for (const q of questions) {
    q._deps = normalizeDeps(q.dependsOn).map(d => {
      const src = byId.get(d.id);
      if (!src || src === q) return { id: d.id, missing: !src };
      return {
        id: src.id,
        prompt: src.prompt,
        guidance: src.guidance,
        showAnswer: d.showAnswer,
        table: src.table || null,
        images: qImages(src).map(it => ({ src: imgSrc(it.file, src._imgBase), alt: it.alt, caption: it.caption })),
        answer: depAnswerData(src)
      };
    });
  }
  return questions;
}

export function depAnswerVisible(dep) {
  if (!dep.showAnswer || !dep.answer) return false;
  if (S.runMode === 'explore') return true;
  const inRun = (S.quiz?.questions || []).find(q => q.id === dep.id);
  if (!inRun) return true;
  const a = S.answers[ak(inRun)];
  return !!(a && a.locked);
}

export function depHtml(q) {
  if (!q._deps?.length) return '';
  const items = q._deps.map(d => {
    if (d.missing) return `<div class="dep-item muted">(${esc(d.id)} - not in this set)</div>`;
    const ans = depAnswerVisible(d) && d.answer ? `
      <div class="dep-answer">
        <b>${esc(d.answer.label)}:</b> ${d.answer.text ? formatPrompt(d.answer.text) : ''}
        ${(d.answer.points || []).map(p => `<div class="dep-point">• ${esc(p)}</div>`).join('')}
        ${d.answer.image ? `<figure class="qfig small"><img src="${esc(d.answer.image)}" alt="${esc(d.answer.alt || '')}" loading="lazy"/></figure>` : ''}
      </div>` : '';
    return `
      <div class="dep-item">
        <b>${esc(d.id)}</b> - ${formatPrompt(d.prompt || '')}
        ${d.table ? tableHtml({ table: d.table }) : ''}
        ${(d.images || []).map(it => `<figure class="qfig small"><img src="${esc(it.src)}" alt="${esc(it.alt || '')}" loading="lazy"/>${it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : ''}</figure>`).join('')}
        ${ans}
      </div>
    `;
  }).join('');
  return `<div class="dep-box"><div class="dep-head">📎 Uses ${q._deps.length === 1 ? 'a previous part' : 'previous parts'}:</div>${items}</div>`;
}
