export interface AppInfo {
  version: string
  dataPath: string
  isPackaged: boolean
}

export type SaveBackupResult =
  | { ok: true; path: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string }

export type OpenBackupResult =
  | { ok: true; content: string; name: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string }

export interface DesktopApi {
  getAppInfo(): Promise<AppInfo>
  saveBackup(content: string, suggestedName: string): Promise<SaveBackupResult>
  openBackup(): Promise<OpenBackupResult>
}
