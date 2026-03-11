import { useTheme } from '../../hooks/useTheme';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const labelMap = {
    dark: 'Escuro',
    light: 'Claro',
    amber: 'Ambar',
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="Alternar tema"
    >
      <span className="theme-toggle__label">
        {labelMap[theme] ?? 'Tema'}
      </span>
    </button>
  );
}

export default ThemeToggle;
