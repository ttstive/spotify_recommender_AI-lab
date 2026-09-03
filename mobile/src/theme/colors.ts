// Committed to a single dark-navy theme for now rather than following the
// system light/dark setting -- revisit if/when a light theme is wanted too.
const darkNavy = {
  background: '#131313',
  surface: '#201F1F',
  border: '#303230',
  text: '#E5E2E1',
  textMuted: '#BCCBB9',
  accent: '#53E076',
  danger: '#F04A54',
  warning: '#FBBF24',
  warningBackground: '#3A2E12',
  success: '#53E076',
};

export type AppColors = typeof darkNavy;

export function useColors(): AppColors {
  return darkNavy;
}
