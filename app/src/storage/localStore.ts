import { defaultAppData } from './defaultData'
import type { AppData } from '../types/domain'

const STORAGE_KEY = 'ai-notebook-data-v1'

export function getStorageKey() {
  return STORAGE_KEY
}

export function loadAppData(): AppData {
  const storedValue = window.localStorage.getItem(STORAGE_KEY)

  if (!storedValue) {
    return defaultAppData
  }

  try {
    const parsedData = JSON.parse(storedValue) as Partial<AppData>

    return {
      ...defaultAppData,
      ...parsedData,
      projects: parsedData.projects ?? defaultAppData.projects,
    }
  } catch {
    return defaultAppData
  }
}

export function saveAppData(data: AppData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function resetAppData() {
  window.localStorage.removeItem(STORAGE_KEY)
}
