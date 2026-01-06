import { useThemePreference } from '@/context/ThemeContext';

export function useColorScheme() {
  const { mode } = useThemePreference();
  return mode;
}
