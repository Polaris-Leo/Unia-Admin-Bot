const STORAGE_KEY = 'unia-theme';

export function getSavedTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'auto';
}

export function applyTheme(theme) {
  if (theme === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  localStorage.setItem(STORAGE_KEY, theme);
}

export function initTheme() {
  applyTheme(getSavedTheme());
}
