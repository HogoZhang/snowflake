import type { ThemeDefinition, ThemeId } from '@shared/schema'

type ThemeTokenName =
  | 'bg'
  | 'surface'
  | 'surface-strong'
  | 'surface-border'
  | 'text'
  | 'text-muted'
  | 'primary'
  | 'primary-soft'
  | 'accent'
  | 'background'
  | 'foreground'
  | 'card'
  | 'border'
  | 'secondary'
  | 'secondary-foreground'
  | 'muted'
  | 'sidebar'
  | 'sidebar-border'
  | 'chart-1'
  | 'chart-2'
  | 'chart-3'
  | 'chart-4'
  | 'shadow'
  | 'radius-xl'
  | 'radius-lg'
  | 'radius-md'

export type ThemeTokens = Record<ThemeTokenName, string>

export interface ThemePreviewPalette {
  gradient: string
  accent: string
  secondary: string
  surface: string
  outline: string
  sticker: string
}

export interface ThemeAssetManifest {
  fontFamily: string
  iconLabel: string
  illustrationLabel: string
}

export interface AppThemeDefinition extends ThemeDefinition {
  id: ThemeId
  description: string
  fontLabel: string
  preview: ThemePreviewPalette
  cssVars: ThemeTokens
  assetLoader?: () => Promise<ThemeAssetManifest>
}

export const THEME_TOKEN_NAMES: ThemeTokenName[] = [
  'bg',
  'surface',
  'surface-strong',
  'surface-border',
  'text',
  'text-muted',
  'primary',
  'primary-soft',
  'accent',
  'background',
  'foreground',
  'card',
  'border',
  'secondary',
  'secondary-foreground',
  'muted',
  'sidebar',
  'sidebar-border',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'shadow',
  'radius-xl',
  'radius-lg',
  'radius-md'
]

const defaultTokens: ThemeTokens = {
  bg: '#fffef9',
  surface: 'rgba(255, 255, 255, 0.92)',
  'surface-strong': '#ffffff',
  'surface-border': 'rgba(255, 107, 107, 0.15)',
  text: '#3d2c1f',
  'text-muted': '#8b7355',
  primary: '#ff6b6b',
  'primary-soft': 'rgba(255, 107, 107, 0.12)',
  accent: '#ffe9b8',
  background: '#fffef9',
  foreground: '#3d2c1f',
  card: '#ffffff',
  border: 'rgba(255, 107, 107, 0.15)',
  secondary: '#ffd93d',
  'secondary-foreground': '#3d2c1f',
  muted: '#fff4e0',
  sidebar: '#fff9e6',
  'sidebar-border': 'rgba(255, 107, 107, 0.2)',
  'chart-1': '#ff6b6b',
  'chart-2': '#ffd93d',
  'chart-3': '#ff9f9f',
  'chart-4': '#ffb84d',
  shadow: '0 18px 40px rgba(255, 107, 107, 0.14)',
  'radius-xl': '24px',
  'radius-lg': '18px',
  'radius-md': '14px'
}

const builtinThemes: AppThemeDefinition[] = [
  {
    id: 'default',
    name: 'default',
    displayName: '简约现代',
    description: '干净白底和柔和高亮，适合长时间查看任务、日记与统计。',
    cssVars: defaultTokens,
    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
    fontLabel: 'Trebuchet / Segoe UI',
    iconSet: 'Rounded UI',
    previewImage: 'modern-gradient',
    preview: {
      gradient: 'linear-gradient(135deg, #fff7ea 0%, #fffefe 48%, #ffe3d6 100%)',
      accent: '#ff6b6b',
      secondary: '#ffd93d',
      surface: '#ffffff',
      outline: 'rgba(255, 107, 107, 0.2)',
      sticker: 'Snow'
    }
  },
  {
    id: 'shinchan',
    name: 'shinchan',
    displayName: '蜡笔小新',
    description: '暖黄底色、厚轮廓和手绘气质，更适合轻松日常记录。',
    cssVars: {
      ...defaultTokens,
      bg: '#fff2cf',
      surface: 'rgba(255, 249, 235, 0.86)',
      'surface-strong': '#fffef7',
      'surface-border': 'rgba(113, 86, 10, 0.18)',
      text: '#473303',
      'text-muted': '#7d6732',
      primary: '#ff8b3d',
      'primary-soft': 'rgba(255, 139, 61, 0.18)',
      accent: '#ffce4f',
      background: '#fff9e5',
      foreground: '#473303',
      border: 'rgba(113, 86, 10, 0.16)',
      secondary: '#ffd54f',
      'secondary-foreground': '#4b3408',
      muted: '#fff1c9',
      sidebar: '#fff5dd',
      'sidebar-border': 'rgba(113, 86, 10, 0.2)',
      'chart-1': '#ff8b3d',
      'chart-2': '#ffd54f',
      'chart-3': '#ffb86b',
      'chart-4': '#cfa14c',
      shadow: '0 18px 36px rgba(183, 122, 18, 0.16)'
    },
    fontFamily: '"Comic Sans MS", "Trebuchet MS", "Segoe UI", sans-serif',
    fontLabel: 'Comic Sans / Trebuchet',
    iconSet: 'Crayon Outline',
    previewImage: 'sunny-crayon',
    preview: {
      gradient: 'linear-gradient(135deg, #fff4b5 0%, #fffbe7 55%, #ffd48d 100%)',
      accent: '#ff8b3d',
      secondary: '#ffd54f',
      surface: '#fffef7',
      outline: 'rgba(113, 86, 10, 0.22)',
      sticker: 'Crayon'
    },
    assetLoader: async () => (await import('./assets/shinchan')).shinchanThemeAssets
  },
  {
    id: 'mickey',
    name: 'mickey',
    displayName: '米老鼠',
    description: '经典红白黑配色配合高对比视觉，适合强调任务状态和统计重点。',
    cssVars: {
      ...defaultTokens,
      bg: '#f5f5f7',
      surface: 'rgba(255, 255, 255, 0.9)',
      'surface-strong': '#ffffff',
      'surface-border': 'rgba(20, 20, 20, 0.14)',
      text: '#171717',
      'text-muted': '#5f5f63',
      primary: '#d8232a',
      'primary-soft': 'rgba(216, 35, 42, 0.12)',
      accent: '#1f1f1f',
      background: '#faf8f3',
      foreground: '#1f1f1f',
      border: 'rgba(216, 35, 42, 0.14)',
      secondary: '#ffd84e',
      'secondary-foreground': '#1f1f1f',
      muted: '#f1efeb',
      sidebar: '#f6f2eb',
      'sidebar-border': 'rgba(20, 20, 20, 0.12)',
      'chart-1': '#d8232a',
      'chart-2': '#ffd84e',
      'chart-3': '#f59f9f',
      'chart-4': '#f5b041',
      shadow: '0 16px 36px rgba(26, 26, 26, 0.16)'
    },
    fontFamily: '"Segoe UI", "Trebuchet MS", sans-serif',
    fontLabel: 'Segoe UI',
    iconSet: 'Classic Toon',
    previewImage: 'toon-contrast',
    preview: {
      gradient: 'linear-gradient(135deg, #fff1f0 0%, #ffffff 46%, #ffe274 100%)',
      accent: '#d8232a',
      secondary: '#ffd84e',
      surface: '#ffffff',
      outline: 'rgba(31, 31, 31, 0.22)',
      sticker: 'Toon'
    },
    assetLoader: async () => (await import('./assets/mickey')).mickeyThemeAssets
  }
]

const assetCache = new Map<ThemeId, Promise<ThemeAssetManifest>>()

export function getThemeDefinitions(): AppThemeDefinition[] {
  return builtinThemes
}

export function getThemeDefinition(themeId: ThemeId): AppThemeDefinition {
  return builtinThemes.find((theme) => theme.id === themeId) ?? builtinThemes[0]
}

export function loadThemeAssets(themeId: ThemeId): Promise<ThemeAssetManifest> {
  const cached = assetCache.get(themeId)
  if (cached) {
    return cached
  }

  const theme = getThemeDefinition(themeId)
  const promise = theme.assetLoader
    ? theme.assetLoader()
    : Promise.resolve({
        fontFamily: theme.fontFamily,
        iconLabel: theme.iconSet,
        illustrationLabel: theme.preview.sticker
      })

  assetCache.set(themeId, promise)
  return promise
}

export function isThemeAssetReady(themeId: ThemeId): boolean {
  return assetCache.has(themeId)
}

export function applyThemeToDocument(themeId: ThemeId, root: HTMLElement = document.documentElement): Promise<ThemeAssetManifest> {
  const theme = getThemeDefinition(themeId)
  root.dataset.theme = theme.id

  for (const tokenName of THEME_TOKEN_NAMES) {
    root.style.setProperty(`--${tokenName}`, theme.cssVars[tokenName])
  }

  root.style.setProperty('--theme-font-family', theme.fontFamily)

  return loadThemeAssets(theme.id).then((assets) => {
    if (root.dataset.theme === theme.id) {
      root.style.setProperty('--theme-font-family', assets.fontFamily)
    }

    return assets
  })
}

export function resetThemeAssetCacheForTests(): void {
  assetCache.clear()
}
