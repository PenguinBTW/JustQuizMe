// Student question-issue flagging: small ⚑ affordance injected into the
// runner question chrome. Posts to the portal's /api/<portal>/flags route;
// the launchpad aggregates counts across portals.
export function attachFlagButton(host, { portal, apiBase, questionOf }) {
  if (!host || host.querySelector('.qflag-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'qflag-btn btn-ghost mono';
  btn.textContent = '⚑';
  btn.title = 'Flag an issue with this question';
  btn.style.cssText = 'font-size:12px; padding:2px 7px; opacity:0.75;';
  btn.onclick = async () => {
    const q = questionOf();
    if (!q) return;
    const issue = window.prompt('What is wrong with this question? (content error, unclear wording, wrong mark scheme…)');
    if (!issue || !issue.trim()) return;
    btn.disabled = true;
    try {
      const r = await fetch(`${apiBase}/api/${portal}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: q.id || '',
          bankFile: q._srcFile || '',
          topic: q.topic || '',
          issue: issue.trim(),
        }),
      });
      btn.textContent = r.ok ? '⚑ ✓' : '⚑ !';
    } catch { btn.textContent = '⚑ !'; }
    setTimeout(() => { btn.textContent = '⚑'; btn.disabled = false; }, 2500);
  };
  const chrome = host.querySelector('.q-chrome') || host;
  chrome.appendChild(btn);
}
