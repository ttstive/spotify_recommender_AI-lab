// Committed to a single dark-navy theme for now rather than following the
// system light/dark setting -- revisit if/when a light theme is wanted too.
const darkNavy = {
  background: '#0B1524',
  surface: '#132338',
  border: '#22374F',
  text: '#F2F6FC',
  textMuted: '#8FA3BC',
  accent: '#4EA1F3',
  danger: '#F04A54',
  warning: '#FBBF24',
  warningBackground: '#3A2E12',
  success: '#34D399',
};

export type AppColors = typeof darkNavy;

export function useColors(): AppColors {
  return darkNavy;
}
