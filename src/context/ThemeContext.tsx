import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setThemeColors } from '../../constants/theme';

export type TextSize = 'Small' | 'Medium' | 'Large';

interface ThemeContextType {
  textSize: TextSize;
  multiplier: number;
  setTextSize: (size: TextSize) => Promise<void>;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [textSize, setTextSizeState] = useState<TextSize>('Medium');
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const storedSize = await AsyncStorage.getItem('user_text_size');
        if (storedSize) {
          setTextSizeState(storedSize as TextSize);
        }
        const storedTheme = await AsyncStorage.getItem('user_theme');
        if (storedTheme === 'dark' || storedTheme === 'light') {
          setThemeColors(storedTheme);
          setThemeState(storedTheme);
        }
      } catch (e) {
        console.warn('Failed to load theme/text-size preferences:', e);
      }
    };
    loadPreferences();
  }, []);

  const setTextSize = async (size: TextSize) => {
    try {
      setTextSizeState(size);
      await AsyncStorage.setItem('user_text_size', size);
    } catch (e) {
      console.warn('Failed to save text size to storage:', e);
    }
  };

  const setTheme = async (newTheme: 'dark' | 'light') => {
    try {
      setThemeColors(newTheme);
      setThemeState(newTheme);
      await AsyncStorage.setItem('user_theme', newTheme);
    } catch (e) {
      console.warn('Failed to save theme to storage:', e);
    }
  };

  const getMultiplier = () => {
    switch (textSize) {
      case 'Small':
        return 0.85;
      case 'Large':
        return 1.25;
      case 'Medium':
      default:
        return 1.0;
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        textSize,
        multiplier: getMultiplier(),
        setTextSize,
        theme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};
