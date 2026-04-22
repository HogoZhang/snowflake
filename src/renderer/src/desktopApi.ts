import type { DesktopApi } from '@shared/schema'

export function getDesktopApi(): DesktopApi {
  if (!window.desktopApi) {
    throw new Error('Desktop bridge is unavailable. Please restart the app.')
  }

  return window.desktopApi
}
