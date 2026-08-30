// تـك توكي - Tuk Tuky App Theme — Black & Gold Identity
export const Colors = {
  // Primary — Deep Gold
  primary: '#E8A020',
  primaryDark: '#C47D0A',
  primaryLight: '#FFF5DC',

  // Accent — Bright Amber
  accent: '#FFD050',
  accentDark: '#D4A800',

  // Background
  bgDark: '#0D0D0D',
  bgNavy: '#1A1400',
  bgLight: '#F9F6F0',
  bgWhite: '#FFFFFF',

  // Text
  textPrimary: '#1A1200',
  textSecondary: '#6B6040',
  textLight: '#A09070',
  textWhite: '#FFFFFF',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#F5A623',

  // Borders
  border: '#EDE0C4',
  borderLight: '#F5EDD8',

  // Cards
  cardBg: '#FFFFFF',
  cardShadow: 'rgba(232, 160, 32, 0.12)',

  // Map
  mapAccent: '#E8A020',

  // Online indicator
  online: '#10B981',
  offline: '#9CA3AF',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

// Tajawal Font Family
export const Fonts = {
  tajawal: {
    regular: 'Tajawal_400Regular',
    medium: 'Tajawal_500Medium',
    semiBold: 'Tajawal_700Bold',
    bold: 'Tajawal_700Bold',
    extraBold: 'Tajawal_800ExtraBold',
  },
  default: 'Tajawal_400Regular',
};

export const Typography = {
  // Sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 34,

  // Weights
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
  extraBold: '800' as const,
};

export const Shadows = {
  sm: {
    shadowColor: '#E8A020',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#C47D0A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#C47D0A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 8,
  },
};
