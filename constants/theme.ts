import { StyleSheet } from 'react-native';

export const LIGHT_COLORS = {
  bg: '#F8F9FA',      // Premium warm off-white background
  bg2: '#FFFFFF',     // Clean pure white for cards and cards deck
  bg3: '#E5E7EB',     // Gray-200 border lines and inactive segment indicators
  gold: '#C9A84C',
  gold2: '#E8C97A',
  teal: '#C9A84C',    // Aligned to Gold for unified gold-themed branding
  teal2: '#E8C97A',  // Aligned to Gold2
  text: '#1F2937',    // Premium dark charcoal (gray-800) for scripture & main titles
  text2: '#4B5563',   // Slate gray (gray-600) for translations
  text3: '#9CA3AF',   // Cool gray (gray-400) for subheaders and captions
};

export const DARK_COLORS = {
  bg: '#0A0E1A',
  bg2: '#111827',
  bg3: '#1a2235',
  gold: '#C9A84C',
  gold2: '#E8C97A',
  teal: '#C9A84C',    // Aligned to Gold for unified gold-themed branding
  teal2: '#E8C97A',   // Aligned to Gold2
  text: '#F0EAD6',
  text2: '#A89F8C',
  text3: '#6B6355',
};

export let activeTheme: 'dark' | 'light' = 'dark';

export const setThemeColors = (theme: 'dark' | 'light') => {
  activeTheme = theme;
};

export const COLORS = {
  get bg() { return activeTheme === 'light' ? LIGHT_COLORS.bg : DARK_COLORS.bg; },
  get bg2() { return activeTheme === 'light' ? LIGHT_COLORS.bg2 : DARK_COLORS.bg2; },
  get bg3() { return activeTheme === 'light' ? LIGHT_COLORS.bg3 : DARK_COLORS.bg3; },
  get gold() { return activeTheme === 'light' ? LIGHT_COLORS.gold : DARK_COLORS.gold; },
  get gold2() { return activeTheme === 'light' ? LIGHT_COLORS.gold2 : DARK_COLORS.gold2; },
  get teal() { return activeTheme === 'light' ? LIGHT_COLORS.teal : DARK_COLORS.teal; },
  get teal2() { return activeTheme === 'light' ? LIGHT_COLORS.teal2 : DARK_COLORS.teal2; },
  get text() { return activeTheme === 'light' ? LIGHT_COLORS.text : DARK_COLORS.text; },
  get text2() { return activeTheme === 'light' ? LIGHT_COLORS.text2 : DARK_COLORS.text2; },
  get text3() { return activeTheme === 'light' ? LIGHT_COLORS.text3 : DARK_COLORS.text3; },
};

// ==========================================
// DEEP-INTERCEPTION REFLECTION PROXIES FOR DYNAMIC STYLING
// Resolves the static StyleSheet.create evaluations at read-time
// ==========================================
const originalCreate = StyleSheet.create;

const makeStyleProxy = (styleObj: any) => {
  if (!styleObj || typeof styleObj !== 'object') return styleObj;

  return new Proxy(styleObj, {
    get(target, prop) {
      // Pass symbols straight through to avoid React/LogBox internal crashes
      if (typeof prop === 'symbol') {
        return target[prop];
      }

      const originalValue = target[prop];
      if (typeof originalValue === 'string') {
        const normalized = originalValue.toLowerCase();

        // Check if color matches any theme tokens in light/dark systems
        const matchKey = Object.keys(DARK_COLORS).find(
          (k) => (DARK_COLORS as any)[k].toLowerCase() === normalized
        ) || Object.keys(LIGHT_COLORS).find(
          (k) => (LIGHT_COLORS as any)[k].toLowerCase() === normalized
        );

        if (matchKey) {
          // Resolve current dynamic theme color value
          return activeTheme === 'light' ? (LIGHT_COLORS as any)[matchKey] : (DARK_COLORS as any)[matchKey];
        }
      }
      return originalValue;
    }
  });
};

(StyleSheet as any).create = function (obj: any) {
  // Allow React Native to register the stylesheet normally under the hood
  originalCreate(obj);

  // Construct a completely plain, unfrozen copy of the input styles
  const mutableTarget: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (val && typeof val === 'object') {
        mutableTarget[key] = { ...val };
      } else {
        mutableTarget[key] = val;
      }
    }
  }

  return new Proxy(mutableTarget, {
    get(target, prop) {
      if (typeof prop === 'symbol') {
        return target[prop];
      }
      const val = target[prop];
      if (val && typeof val === 'object') {
        return makeStyleProxy(val);
      }
      return val;
    }
  });
};

export const THEME = {
  colors: COLORS,
  fonts: {
    amiri: 'Amiri_400Regular',
    amiriBold: 'Amiri_700Bold',
  },
};

export default THEME;
