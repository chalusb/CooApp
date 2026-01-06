import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';

type ThemeMode = Exclude<ColorSchemeName, null | undefined>;

type ThemePreferenceContextValue = {
  mode: ThemeMode;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
  isManualSelection: boolean;
};

const DEFAULT_MODE: ThemeMode = 'light';

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>({
  mode: DEFAULT_MODE,
  toggleMode: () => {},
  setMode: () => {},
  isManualSelection: false,
});

export const ThemePreferenceProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const systemScheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  const [mode, setMode] = useState<ThemeMode>(systemScheme);
  const [isManualSelection, setIsManualSelection] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (isManualSelection || !isMounted.current) {
        return;
      }
      setMode(colorScheme === 'dark' ? 'dark' : 'light');
    });

    return () => {
      subscription.remove();
    };
  }, [isManualSelection]);

  const toggleMode = useCallback(() => {
    setMode(prev => (prev === 'dark' ? 'light' : 'dark'));
    setIsManualSelection(true);
  }, []);

  const handleSetMode = useCallback((nextMode: ThemeMode) => {
    setMode(nextMode);
    setIsManualSelection(true);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      toggleMode,
      setMode: handleSetMode,
      isManualSelection,
    }),
    [handleSetMode, isManualSelection, mode, toggleMode],
  );

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
};

export const useThemePreference = () => useContext(ThemePreferenceContext);
