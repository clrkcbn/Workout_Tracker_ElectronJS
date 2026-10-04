import type { DesktopApi } from './api'

declare global {
  interface Window {
    /** Present when running inside Electron; absent in plain browser previews. */
    desktop?: DesktopApi
  }
}

export {}
