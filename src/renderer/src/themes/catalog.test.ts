import { describe, expect, test } from 'vitest'

import {
  THEME_TOKEN_NAMES,
  getThemeDefinition,
  getThemeDefinitions,
  loadThemeAssets,
  resetThemeAssetCacheForTests
} from './catalog'

describe('theme catalog', () => {
  test('exposes the three built-in themes with normalized token keys', () => {
    const themes = getThemeDefinitions()

    expect(themes.map((theme) => theme.id)).toEqual(['default', 'shinchan', 'mickey'])

    for (const theme of themes) {
      expect(Object.keys(theme.cssVars).sort()).toEqual([...THEME_TOKEN_NAMES].sort())
    }
  })

  test('caches lazily loaded assets after the first theme activation', async () => {
    resetThemeAssetCacheForTests()

    const firstAssets = await loadThemeAssets('shinchan')
    const secondAssets = await loadThemeAssets('shinchan')

    expect(secondAssets).toEqual(firstAssets)
    expect(firstAssets.fontFamily).toContain('Comic Sans')
    expect(firstAssets.iconLabel).toBe(getThemeDefinition('shinchan').iconSet)
  })
})
