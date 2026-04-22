/// <reference types="vite/client" />

import type { DesktopApi } from '@shared/schema'

declare global {
  interface Window {
    desktopApi: DesktopApi
  }
}

export {}
