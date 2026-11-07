const KEY = 'oracoes-theme';
export type Theme = 'auto' | 'light' | 'dark';
export const THEME_LABEL: Record<Theme, string> = { auto: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: escuro' };

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(theme: Theme) {
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Sem armazenamento, o tema vale só para esta visita.
  }
}
