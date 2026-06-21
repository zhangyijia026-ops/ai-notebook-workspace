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

    return normalizeAppData(parsedData)
  } catch {
    return defaultAppData
  }
}

export function normalizeAppData(data: Partial<AppData>): AppData {
  return {
    ...defaultAppData,
    ...data,
    notebooks: data.notebooks ?? defaultAppData.notebooks,
    notes: data.notes ?? defaultAppData.notes,
    todos: data.todos ?? defaultAppData.todos,
    clips: data.clips ?? defaultAppData.clips,
  }
}

export function saveAppData(data: AppData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function resetAppData() {
  window.localStorage.removeItem(STORAGE_KEY)
}
