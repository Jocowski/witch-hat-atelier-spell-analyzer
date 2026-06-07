import { useTheme } from './ThemeProvider.jsx'

const LABELS = {
  brown: 'Brown',
  dark: 'Dark',
  light: 'Light',
  arcane: 'Arcane',
}

export default function ThemeSwitcher() {
  const { theme, setTheme, THEMES } = useTheme()

  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
      aria-label="Theme"
      title="Switch theme"
    >
      {THEMES.map((t) => (
        <option key={t} value={t}>{LABELS[t]}</option>
      ))}
    </select>
  )
}
