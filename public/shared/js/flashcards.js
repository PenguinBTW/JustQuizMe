// Flashcard logic — pure functions, no DOM.
//
// Card suitability: flashcards are fast-recall, so a card needs a short definite
// answer. MCQs (stem → correct option), written/short questions (prompt → mark
// scheme points), calculations (prompt → exact answer) qualify. Code, LMC,
// trace/truth tables and extended responses don't — they're deep-work types.

export function cardFromQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  const front = (q.prompt || '').trim();
  if (!front) return null;
  // cards are self-contained recall — questions whose meaning lives in a
  // diagram, image or data table can't be answered from the stem alone
  if (q.image || q.images || q.table || q.tableData || q.answerImage) return null;
  if (q.type === 'multiple-choice') {
    const correct = Array.isArray(q.options) ? q.options[q.correctIndex] : null;
    const text = correct && (typeof correct === 'object' ? correct.text : correct);
    if (!text) return null;
    const choices = q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${typeof o === 'object' ? o.text : o}`).join('\n');
    return { front: `${front}\n${choices}`, back: String(text), topic: q.topic || q._topic || null, marks: +q.marks || 1, id: q.id || null, key: q._key || q.id || null };
  }
  if (q.type === 'written' || q.type === 'self-marked') {
    const scheme = Array.isArray(q.markScheme) ? q.markScheme.filter(Boolean) : [];
    if (!scheme.length) return null;
    return { front, back: scheme.map(s => `• ${typeof s === 'object' ? s.text || s.point || '' : s}`).join('\n'), topic: q.topic || q._topic || null, marks: +q.marks || 1, id: q.id || null, key: q._key || q.id || null };
  }
  if (q.type === 'calculation') {
    const ans = q.answer ?? q.correctAnswer ?? q.expected;
    if (ans == null || ans === '') return null;
    return { front, back: String(ans), topic: q.topic || q._topic || null, marks: +q.marks || 1, id: q.id || null, key: q._key || q.id || null };
  }
  return null;
}

export function deckFromQuestions(questions) {
  const seen = new Set();
  return (questions || []).map(cardFromQuestion).filter(Boolean).filter(c => {
    const key = c.key || c.front;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Mastery-weighted ordering: cards whose topic is weak come first, then
// unpracticed topics, then strong ones — within each band, stable input order.
// Unknown topics (no mastery row) count as unpracticed: new material deserves
// recall practice before already-strong material, but after fixing weaknesses.
export function orderDeckByMastery(cards, masteryRows) {
  const byTopic = new Map((masteryRows || []).map(r => [r.topic, r]));
  const band = c => {
    const r = byTopic.get(c.topic);
    if (!r) return 1;            // unpracticed/unknown
    if (r.weak) return 0;        // weak first
    return 2;                    // strong last
  };
  return [...(cards || [])]
    .map((c, i) => ({ c, i }))
    .sort((a, b) => band(a.c) - band(b.c) || a.i - b.i)
    .map(x => x.c);
}
