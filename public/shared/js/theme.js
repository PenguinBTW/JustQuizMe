// Universal JustQuizMe Theme Controller

export function initTheme(btnId = 'themeBtn') {
  const saved = localStorage.getItem('jqm_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeButton(saved, btnId);
}

export function toggleTheme(btnId = 'themeBtn') {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('jqm_theme', next);
  updateThemeButton(next, btnId);
  return next;
}

export function updateThemeButton(theme, btnId = 'themeBtn') {
  const btn = document.getElementById(btnId);
  if (btn) {
    btn.textContent = theme === 'dark' ? 'Paper Theme' : 'Dark Theme';
  }
}
