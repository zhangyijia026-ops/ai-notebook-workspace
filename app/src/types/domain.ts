export type Notebook = {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export type Note = {
  id: string
  notebookId: string
  title: string
  content: string
  summary?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type TodoStatus = 'pending' | 'completed'

export type TodoPriority = 'high' | 'medium' | 'low'

export type Todo = {
  id: string
  title: string
  status: TodoStatus
  priority: TodoPriority
  dueDate?: string
  sourceNoteId?: string
  sourceNoteLineKey?: string
  sourceClipId?: string
  createdAt: string
  completedAt?: string
}

export type ClipSource =
  | 'xiaohongshu'
  | 'ai_chat'
  | 'wechat'
  | 'feishu'
  | 'web'
  | 'manual'
  | 'other'

export type Clip = {
  id: string
  source: ClipSource
  sourceUrl?: string
  title?: string
  rawContent: string
  summary?: string
  tags: string[]
  recommendedNotebookId?: string
  createdAt: string
  updatedAt: string
}

export type AppData = {
  notebooks: Notebook[]
  notes: Note[]
  todos: Todo[]
  clips: Clip[]
}
