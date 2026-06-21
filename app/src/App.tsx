import { useEffect, useMemo, useState } from 'react'
import { generateReport, organizeContent } from './services/aiService'
import {
  diagnoseCloudSync,
  getCloudSyncState,
  loadCloudData,
  saveCloudData,
  signInWithEmail,
  signOutCloud,
  signUpWithEmail,
  type CloudSyncState,
} from './services/cloudSync'
import { getStorageKey, loadAppData, normalizeAppData, saveAppData } from './storage/localStore'
import type { AppData, Clip, ClipSource, Note, Notebook, Todo, TodoPriority, TodoStatus } from './types/domain'
import './App.css'

type PageKey = 'dashboard' | 'notes' | 'todos' | 'inbox' | 'assistant' | 'search'
type TodoFilter = 'today' | 'pending' | 'completed' | 'overdue' | 'from_notes' | 'all'
type ClipSourceFilter = ClipSource | 'all'
type QuickCaptureType = 'note' | 'todo' | 'clip'
type ReportType = 'daily' | 'weekly'
type ClipAiDraft = {
  title: string
  summary: string
  tagsText: string
  recommendedNotebookId: string
}
type SearchResult =
  | {
      id: string
      type: 'note'
      title: string
      excerpt: string
      noteId: string
      notebookId: string
    }
  | {
      id: string
      type: 'todo'
      title: string
      excerpt: string
      todoId: string
      sourceNoteId?: string
    }
  | {
      id: string
      type: 'clip'
      title: string
      excerpt: string
      clipId: string
      source: ClipSource
    }

type NavigationItem = {
  key: PageKey
  label: string
  description: string
}

const navigationItems: NavigationItem[] = [
  {
    key: 'dashboard',
    label: '工作台',
    description: '今日任务、最近笔记和快捷记录',
  },
  {
    key: 'notes',
    label: '笔记本',
    description: '管理笔记本、笔记和笔记内 Todo',
  },
  {
    key: 'todos',
    label: 'Todo',
    description: '查看今日、未完成、逾期和来自笔记的任务',
  },
  {
    key: 'inbox',
    label: '收集箱',
    description: '保存小红书、AI 聊天、微信和飞书摘录',
  },
  {
    key: 'assistant',
    label: 'AI 助手',
    description: '总结、分类、提取 Todo、生成日报周报',
  },
  {
    key: 'search',
    label: '搜索',
    description: '搜索笔记、Todo、摘录、摘要和标签',
  },
]

const pageContent: Record<PageKey, { title: string; eyebrow: string; body: string; actions: string[] }> = {
  dashboard: {
    eyebrow: 'Milestone 1',
    title: '首页工作台',
    body: '首页工作台会在笔记、Todo 和摘录模块完成后接入真实数据。',
    actions: ['快速记录', '生成今日日报', '整理待分类内容'],
  },
  notes: {
    eyebrow: 'Milestone 2',
    title: '笔记本',
    body: '管理笔记本、笔记列表和笔记编辑区。',
    actions: ['新建笔记本', '新建笔记', '自动保存'],
  },
  todos: {
    eyebrow: 'Milestone 3',
    title: 'Todo',
    body: 'Todo 管理会在下一阶段实现。',
    actions: ['新建 Todo', '筛选任务', '跳转来源笔记'],
  },
  inbox: {
    eyebrow: 'Milestone 5',
    title: '摘录收集箱',
    body: '摘录收集箱会在笔记和 Todo 模块之后实现。',
    actions: ['粘贴摘录', 'AI 总结', '转为笔记'],
  },
  assistant: {
    eyebrow: 'Milestone 6-7',
    title: 'AI 助手',
    body: 'AI 总结、分类和日报周报生成会在基础数据模块完成后实现。',
    actions: ['生成日报', '生成周报', '搜索我的笔记'],
  },
  search: {
    eyebrow: 'Milestone 8',
    title: '搜索',
    body: '搜索笔记、Todo、摘录、摘要和标签。',
    actions: ['搜索笔记', '搜索 Todo', '搜索摘录'],
  },
}

const clipSourceLabels: Record<ClipSource, string> = {
  xiaohongshu: '小红书',
  ai_chat: 'AI 聊天',
  wechat: '微信',
  feishu: '飞书',
  web: '网页',
  manual: '手动输入',
  other: '其他',
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function getTimestamp() {
  return new Date().toISOString()
}

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10)
}

function buildFallbackTitle(content: string, fallback = '未命名笔记') {
  const firstLine = content
    .split('\n')
    .map((line) => line.trim().replace(/^#+\s*/, ''))
    .find(Boolean)

  if (!firstLine) {
    return fallback
  }

  return firstLine.slice(0, 36)
}

function isTodoOverdue(todo: Todo) {
  return Boolean(todo.dueDate && todo.status !== 'completed' && todo.dueDate < getTodayDateValue())
}

function getPriorityLabel(priority: TodoPriority) {
  const labels: Record<TodoPriority, string> = {
    high: '高',
    medium: '中',
    low: '低',
  }

  return labels[priority]
}

function getStatusLabel(status: TodoStatus) {
  return status === 'completed' ? '已完成' : '未完成'
}

type ParsedMarkdownTodo = {
  lineKey: string
  title: string
  status: TodoStatus
  priority: TodoPriority
  dueDate?: string
}

function parseMarkdownTodos(content: string): ParsedMarkdownTodo[] {
  return content
    .split('\n')
    .map((line, index): ParsedMarkdownTodo | null => {
      const match = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(?:\[(高|中|低)\]\s*)?(?:\[(\d{4}-\d{2}-\d{2})\]\s*)?(.+?)\s*$/)

      if (!match) {
        return null
      }

      const priorityMap: Record<string, TodoPriority> = {
        高: 'high',
        中: 'medium',
        低: 'low',
      }

      return {
        lineKey: `line_${index + 1}`,
        title: match[4].trim(),
        status: match[1].toLowerCase() === 'x' ? 'completed' : 'pending',
        priority: priorityMap[match[2]] ?? 'medium',
        dueDate: match[3],
      }
    })
    .filter((todo): todo is ParsedMarkdownTodo => Boolean(todo))
}

function syncNoteTodos(
  todos: Todo[],
  noteId: string,
  content: string,
  timestamp: string,
) {
  const parsedTodos = parseMarkdownTodos(content)
  const parsedLineKeys = new Set(parsedTodos.map((todo) => todo.lineKey))
  const existingNoteTodos = todos.filter((todo) => todo.sourceNoteId === noteId && todo.sourceNoteLineKey)
  const existingByLineKey = new Map(existingNoteTodos.map((todo) => [todo.sourceNoteLineKey, todo]))

  const withoutRemovedNoteTodos = todos.filter((todo) => {
    if (todo.sourceNoteId !== noteId || !todo.sourceNoteLineKey) {
      return true
    }

    return parsedLineKeys.has(todo.sourceNoteLineKey)
  })

  const updatedTodos = withoutRemovedNoteTodos.map((todo) => {
    if (todo.sourceNoteId !== noteId || !todo.sourceNoteLineKey) {
      return todo
    }

    const parsedTodo = parsedTodos.find((item) => item.lineKey === todo.sourceNoteLineKey)

    if (!parsedTodo) {
      return todo
    }

    return {
      ...todo,
      title: parsedTodo.title,
      status: parsedTodo.status,
      priority: parsedTodo.priority,
      dueDate: parsedTodo.dueDate,
      completedAt: parsedTodo.status === 'completed' ? todo.completedAt ?? timestamp : undefined,
    }
  })

  const newTodos = parsedTodos
    .filter((parsedTodo) => !existingByLineKey.has(parsedTodo.lineKey))
    .map<Todo>((parsedTodo) => ({
      id: createId('todo'),
      title: parsedTodo.title,
      status: parsedTodo.status,
      priority: parsedTodo.priority,
      dueDate: parsedTodo.dueDate,
      sourceNoteId: noteId,
      sourceNoteLineKey: parsedTodo.lineKey,
      createdAt: timestamp,
      completedAt: parsedTodo.status === 'completed' ? timestamp : undefined,
    }))

  return [...newTodos, ...updatedTodos]
}

function App() {
  const [activePage, setActivePage] = useState<PageKey>('notes')
  const [appData, setAppData] = useState<AppData>(() => loadAppData())
  const [activeNotebookId, setActiveNotebookId] = useState<string>(() => {
    return loadAppData().notebooks[0]?.id ?? ''
  })
  const [activeNoteId, setActiveNoteId] = useState<string | null>(() => {
    const initialData = loadAppData()
    return initialData.notes[0]?.id ?? null
  })
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('pending')
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoPriority, setNewTodoPriority] = useState<TodoPriority>('medium')
  const [newTodoDueDate, setNewTodoDueDate] = useState(() => getTodayDateValue())
  const [newTodoSourceNoteId, setNewTodoSourceNoteId] = useState('')
  const [clipContent, setClipContent] = useState('')
  const [clipSource, setClipSource] = useState<ClipSource>('xiaohongshu')
  const [clipSourceUrl, setClipSourceUrl] = useState('')
  const [clipFilter, setClipFilter] = useState<ClipSourceFilter>('all')
  const [organizingClipId, setOrganizingClipId] = useState<string | null>(null)
  const [clipAiDrafts, setClipAiDrafts] = useState<Record<string, ClipAiDraft>>({})
  const [quickCaptureText, setQuickCaptureText] = useState('')
  const [quickCaptureType, setQuickCaptureType] = useState<QuickCaptureType>('note')
  const [organizingNoteId, setOrganizingNoteId] = useState<string | null>(null)
  const [reportType, setReportType] = useState<ReportType>('daily')
  const [reportTitle, setReportTitle] = useState('')
  const [reportContent, setReportContent] = useState('')
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [cloudSyncState, setCloudSyncState] = useState<CloudSyncState>({ configured: false, user: null })
  const [cloudEmail, setCloudEmail] = useState('')
  const [cloudPassword, setCloudPassword] = useState('')
  const [cloudStatus, setCloudStatus] = useState('云同步尚未连接')
  const [isCloudSyncing, setIsCloudSyncing] = useState(false)

  useEffect(() => {
    saveAppData(appData)
  }, [appData])

  useEffect(() => {
    void refreshCloudState()
  }, [])

  useEffect(() => {
    const syncNewTodoDateToToday = () => {
      setNewTodoDueDate((currentDueDate) => currentDueDate || getTodayDateValue())
    }

    syncNewTodoDateToToday()
    const timer = window.setInterval(syncNewTodoDateToToday, 60 * 1000)

    return () => window.clearInterval(timer)
  }, [])

  const activeContent = pageContent[activePage]

  const currentDate = useMemo(() => {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(new Date())
  }, [])

  const activeNotebook = appData.notebooks.find((notebook) => notebook.id === activeNotebookId)
  const notesInActiveNotebook = appData.notes
    .filter((note) => note.notebookId === activeNotebookId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const activeNote = appData.notes.find((note) => note.id === activeNoteId) ?? null
  const filteredTodos = appData.todos
    .filter((todo) => {
      if (todoFilter === 'today') {
        return todo.dueDate === getTodayDateValue()
      }

      if (todoFilter === 'pending') {
        return todo.status === 'pending'
      }

      if (todoFilter === 'completed') {
        return todo.status === 'completed'
      }

      if (todoFilter === 'overdue') {
        return isTodoOverdue(todo)
      }

      if (todoFilter === 'from_notes') {
        return Boolean(todo.sourceNoteId)
      }

      return true
    })
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'pending' ? -1 : 1
      }

      if (a.dueDate && b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate)
      }

      if (a.dueDate) {
        return -1
      }

      if (b.dueDate) {
        return 1
      }

      return b.createdAt.localeCompare(a.createdAt)
    })

  const todoStats = {
    today: appData.todos.filter((todo) => todo.dueDate === getTodayDateValue()).length,
    pending: appData.todos.filter((todo) => todo.status === 'pending').length,
    completed: appData.todos.filter((todo) => todo.status === 'completed').length,
    overdue: appData.todos.filter(isTodoOverdue).length,
    fromNotes: appData.todos.filter((todo) => todo.sourceNoteId).length,
    all: appData.todos.length,
  }
  const filteredClips = appData.clips
    .filter((clip) => clipFilter === 'all' || clip.source === clipFilter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const todayTodos = appData.todos
    .filter((todo) => todo.dueDate === getTodayDateValue() || (todo.status === 'pending' && !todo.dueDate))
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'pending' ? -1 : 1
      }

      return (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99')
    })
    .slice(0, 6)
  const recentNotes = [...appData.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
  const recentClips = [...appData.clips].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  const reportNotebook = appData.notebooks.find((notebook) => notebook.id === 'notebook_reports') ?? appData.notebooks[0]
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!normalizedSearchQuery) {
      return []
    }

    const matches = (values: Array<string | undefined>) =>
      values.some((value) => value?.toLowerCase().includes(normalizedSearchQuery))

    const noteResults: SearchResult[] = appData.notes
      .filter((note) => matches([note.title, note.content, note.summary, note.tags.join(' ')]))
      .map((note) => ({
        id: `note_${note.id}`,
        type: 'note',
        title: note.title || '未命名笔记',
        excerpt: note.summary || note.content || '暂无正文',
        noteId: note.id,
        notebookId: note.notebookId,
      }))

    const todoResults: SearchResult[] = appData.todos
      .filter((todo) => matches([todo.title, todo.status, todo.priority, todo.dueDate]))
      .map((todo) => ({
        id: `todo_${todo.id}`,
        type: 'todo',
        title: todo.title,
        excerpt: `${getStatusLabel(todo.status)} · ${getPriorityLabel(todo.priority)}优先级${todo.dueDate ? ` · ${todo.dueDate}` : ''}`,
        todoId: todo.id,
        sourceNoteId: todo.sourceNoteId,
      }))

    const clipResults: SearchResult[] = appData.clips
      .filter((clip) => matches([clip.rawContent, clip.summary, clip.tags.join(' '), clip.sourceUrl, clipSourceLabels[clip.source]]))
      .map((clip) => ({
        id: `clip_${clip.id}`,
        type: 'clip',
        title: clipSourceLabels[clip.source],
        excerpt: clip.summary || clip.rawContent,
        clipId: clip.id,
        source: clip.source,
      }))

    return [...noteResults, ...todoResults, ...clipResults].slice(0, 50)
  }, [appData.clips, appData.notes, appData.todos, normalizedSearchQuery])

  function updateData(updater: (current: AppData) => AppData) {
    setAppData((current) => updater(current))
  }

  async function refreshCloudState() {
    const state = await getCloudSyncState()
    setCloudSyncState(state)

    if (!state.configured) {
      setCloudStatus('未配置 Supabase。请先在 .env 中填写 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。')
      return
    }

    setCloudStatus(state.user ? `已登录：${state.user.email ?? state.user.id}` : 'Supabase 已配置，尚未登录。')
  }

  async function handleCloudAuth(mode: 'sign_in' | 'sign_up') {
    const email = cloudEmail.trim()
    const password = cloudPassword.trim()

    if (!email || !password) {
      setCloudStatus('请输入邮箱和密码。')
      return
    }

    setIsCloudSyncing(true)

    try {
      const result =
        mode === 'sign_in' ? await signInWithEmail(email, password) : await signUpWithEmail(email, password)

      if (result.error) {
        setCloudStatus(result.error.message)
        return
      }

      await refreshCloudState()
      setCloudStatus(mode === 'sign_in' ? '登录成功。' : '注册成功。如 Supabase 要求邮箱确认，请先完成邮件确认。')
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '云端登录失败。')
    } finally {
      setIsCloudSyncing(false)
    }
  }

  async function handleCloudSignOut() {
    setIsCloudSyncing(true)

    try {
      await signOutCloud()
      await refreshCloudState()
      setCloudStatus('已退出云同步账号。')
    } finally {
      setIsCloudSyncing(false)
    }
  }

  async function handleUploadLocalDataToCloud() {
    if (!cloudSyncState.user) {
      setCloudStatus('请先登录 Supabase 账号。')
      return
    }

    setIsCloudSyncing(true)

    try {
      await saveCloudData(cloudSyncState.user.id, appData)
      setCloudStatus(`已上传本地数据到云端：${new Date().toLocaleString('zh-CN')}`)
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '上传云端失败。')
    } finally {
      setIsCloudSyncing(false)
    }
  }

  async function handleDiagnoseCloudSync() {
    if (!cloudSyncState.user) {
      setCloudStatus('请先登录 Supabase 账号。')
      return
    }

    setIsCloudSyncing(true)

    try {
      const message = await diagnoseCloudSync(cloudSyncState.user.id)
      setCloudStatus(message)
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : 'Supabase 诊断失败。')
    } finally {
      setIsCloudSyncing(false)
    }
  }

  async function handleLoadCloudDataToLocal() {
    if (!cloudSyncState.user) {
      setCloudStatus('请先登录 Supabase 账号。')
      return
    }

    const confirmed = window.confirm('从云端拉取会覆盖当前浏览器里的本地数据。建议先导出 JSON 备份。确认继续吗？')

    if (!confirmed) {
      return
    }

    setIsCloudSyncing(true)

    try {
      const cloudRow = await loadCloudData(cloudSyncState.user.id)

      if (!cloudRow?.data) {
        setCloudStatus('云端还没有保存过数据。')
        return
      }

      const normalizedData = normalizeAppData(cloudRow.data)
      setAppData(normalizedData)
      setActiveNotebookId(normalizedData.notebooks[0]?.id ?? '')
      setActiveNoteId(normalizedData.notes[0]?.id ?? null)
      setCloudStatus(`已从云端恢复数据：${new Date(cloudRow.updated_at).toLocaleString('zh-CN')}`)
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : '从云端拉取失败。')
    } finally {
      setIsCloudSyncing(false)
    }
  }

  function handleCreateNotebook() {
    const name = window.prompt('请输入新笔记本名称', '小张的笔记')
    const trimmedName = name?.trim()

    if (!trimmedName) {
      return
    }

    const timestamp = getTimestamp()
    const notebook: Notebook = {
      id: createId('notebook'),
      name: trimmedName,
      description: '自定义笔记本',
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    updateData((current) => ({
      ...current,
      notebooks: [...current.notebooks, notebook],
    }))
    setActiveNotebookId(notebook.id)
    setActiveNoteId(null)
  }

  function handleRenameNotebook(notebook: Notebook) {
    const name = window.prompt('请输入新的笔记本名称', notebook.name)
    const trimmedName = name?.trim()

    if (!trimmedName || trimmedName === notebook.name) {
      return
    }

    const timestamp = getTimestamp()

    updateData((current) => ({
      ...current,
      notebooks: current.notebooks.map((item) =>
        item.id === notebook.id
          ? {
              ...item,
              name: trimmedName,
              updatedAt: timestamp,
            }
          : item,
      ),
    }))
  }

  function handleUpdateNotebookDescription(notebook: Notebook) {
    const description = window.prompt('请输入笔记本描述', notebook.description || '')

    if (description === null) {
      return
    }

    const timestamp = getTimestamp()

    updateData((current) => ({
      ...current,
      notebooks: current.notebooks.map((item) =>
        item.id === notebook.id
          ? {
              ...item,
              description: description.trim(),
              updatedAt: timestamp,
            }
          : item,
      ),
    }))
  }

  function handleDeleteNotebook(notebook: Notebook) {
    const noteCount = appData.notes.filter((note) => note.notebookId === notebook.id).length

    if (noteCount > 0) {
      window.alert('这个笔记本里还有笔记。请先移动或删除笔记，再删除笔记本。')
      return
    }

    if (appData.notebooks.length <= 1) {
      window.alert('至少需要保留一个笔记本。')
      return
    }

    const confirmed = window.confirm(`确认删除笔记本“${notebook.name}”吗？`)

    if (!confirmed) {
      return
    }

    updateData((current) => ({
      ...current,
      notebooks: current.notebooks.filter((item) => item.id !== notebook.id),
    }))

    if (activeNotebookId === notebook.id) {
      const nextNotebook = appData.notebooks.find((item) => item.id !== notebook.id)
      setActiveNotebookId(nextNotebook?.id ?? '')
      setActiveNoteId(null)
    }
  }

  function handleCreateNote() {
    const timestamp = getTimestamp()
    const notebookId = activeNotebookId || appData.notebooks[0]?.id

    if (!notebookId) {
      return
    }

    const note: Note = {
      id: createId('note'),
      notebookId,
      title: '未命名笔记',
      content: '',
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    updateData((current) => ({
      ...current,
      notes: [note, ...current.notes],
    }))
    setActiveNotebookId(notebookId)
    setActiveNoteId(note.id)
  }

  function handleUpdateNote(noteId: string, fields: Partial<Pick<Note, 'title' | 'content' | 'notebookId'>>) {
    const timestamp = getTimestamp()

    updateData((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              ...fields,
              updatedAt: timestamp,
            }
          : note,
      ),
      todos:
        typeof fields.content === 'string'
          ? syncNoteTodos(current.todos, noteId, fields.content, timestamp)
          : current.todos,
    }))

    if (fields.notebookId) {
      setActiveNotebookId(fields.notebookId)
    }
  }

  async function handleOrganizeNoteFully(note: Note) {
    const sourceText = note.content || note.summary || note.title

    if (!sourceText.trim()) {
      return
    }

    setOrganizingNoteId(note.id)

    try {
      const result = await organizeContent(sourceText, 'manual')
      const timestamp = getTimestamp()
      const title = (result.title || buildFallbackTitle(sourceText)).trim()
      updateData((current) => ({
        ...current,
        notes: current.notes.map((item) =>
          item.id === note.id
            ? {
                ...item,
                title,
                summary: result.summary,
                tags: result.tags,
                notebookId: result.recommendedNotebookId || item.notebookId,
                updatedAt: timestamp,
              }
            : item,
        ),
      }))

      if (result.recommendedNotebookId) {
        setActiveNotebookId(result.recommendedNotebookId)
      }
    } finally {
      setOrganizingNoteId(null)
    }
  }

  function handleDeleteNote(noteId: string) {
    const confirmed = window.confirm('确认删除这条笔记吗？')

    if (!confirmed) {
      return
    }

    updateData((current) => ({
      ...current,
      notes: current.notes.filter((note) => note.id !== noteId),
      todos: current.todos.filter((todo) => todo.sourceNoteId !== noteId),
    }))

    if (activeNoteId === noteId) {
      const nextNote = notesInActiveNotebook.find((note) => note.id !== noteId)
      setActiveNoteId(nextNote?.id ?? null)
    }
  }

  function handleSelectNotebook(notebookId: string) {
    setActiveNotebookId(notebookId)
    const nextNote = appData.notes
      .filter((note) => note.notebookId === notebookId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    setActiveNoteId(nextNote?.id ?? null)
  }

  function handleCreateTodo() {
    const trimmedTitle = newTodoTitle.trim()

    if (!trimmedTitle) {
      return
    }

    const timestamp = getTimestamp()
    const todo: Todo = {
      id: createId('todo'),
      title: trimmedTitle,
      status: 'pending',
      priority: newTodoPriority,
      dueDate: newTodoDueDate || undefined,
      sourceNoteId: newTodoSourceNoteId || undefined,
      createdAt: timestamp,
    }

    updateData((current) => ({
      ...current,
      todos: [todo, ...current.todos],
    }))

    setNewTodoTitle('')
    setNewTodoDueDate(getTodayDateValue())
    setNewTodoSourceNoteId('')
    setNewTodoPriority('medium')
  }

  function handleQuickCapture() {
    const trimmedText = quickCaptureText.trim()

    if (!trimmedText) {
      return
    }

    const timestamp = getTimestamp()

    if (quickCaptureType === 'todo') {
      const todo: Todo = {
        id: createId('todo'),
        title: trimmedText,
        status: 'pending',
        priority: 'medium',
        dueDate: getTodayDateValue(),
        createdAt: timestamp,
      }

      updateData((current) => ({
        ...current,
        todos: [todo, ...current.todos],
      }))
    }

    if (quickCaptureType === 'note') {
      const notebookId = appData.notebooks[0]?.id || 'notebook_work'
      const note: Note = {
        id: createId('note'),
        notebookId,
        title: trimmedText.slice(0, 30) || '快速记录',
        content: trimmedText,
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      updateData((current) => ({
        ...current,
        notes: [note, ...current.notes],
      }))
      setActiveNotebookId(notebookId)
      setActiveNoteId(note.id)
    }

    if (quickCaptureType === 'clip') {
      const clip: Clip = {
        id: createId('clip'),
        source: 'manual',
        rawContent: trimmedText,
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      updateData((current) => ({
        ...current,
        clips: [clip, ...current.clips],
      }))
    }

    setQuickCaptureText('')
  }

  function handleToggleTodo(todoId: string) {
    const timestamp = getTimestamp()

    updateData((current) => ({
      ...current,
      todos: current.todos.map((todo) => {
        if (todo.id !== todoId) {
          return todo
        }

        const nextStatus: TodoStatus = todo.status === 'completed' ? 'pending' : 'completed'

        return {
          ...todo,
          status: nextStatus,
          completedAt: nextStatus === 'completed' ? timestamp : undefined,
        }
      }),
      notes: current.notes.map((note) => {
        const targetTodo = current.todos.find((todo) => todo.id === todoId)

        if (!targetTodo?.sourceNoteId || !targetTodo.sourceNoteLineKey || note.id !== targetTodo.sourceNoteId) {
          return note
        }

        const nextStatus = targetTodo.status === 'completed' ? ' ' : 'x'
        const nextContent = note.content
          .split('\n')
          .map((line, index) => {
            if (`line_${index + 1}` !== targetTodo.sourceNoteLineKey) {
              return line
            }

            return line.replace(/^(\s*[-*]\s+\[)( |x|X)(\]\s+.+?\s*)$/, `$1${nextStatus}$3`)
          })
          .join('\n')

        return {
          ...note,
          content: nextContent,
          updatedAt: timestamp,
        }
      }),
    }))
  }

  function handleUpdateTodo(
    todoId: string,
    fields: Partial<Pick<Todo, 'title' | 'priority' | 'dueDate' | 'sourceNoteId'>>,
  ) {
    updateData((current) => ({
      ...current,
      todos: current.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              ...fields,
              dueDate: fields.dueDate === '' ? undefined : fields.dueDate ?? todo.dueDate,
              sourceNoteId: fields.sourceNoteId === '' ? undefined : fields.sourceNoteId ?? todo.sourceNoteId,
            }
          : todo,
      ),
    }))
  }

  function handleDeleteTodo(todoId: string) {
    const confirmed = window.confirm('确认删除这条 Todo 吗？')

    if (!confirmed) {
      return
    }

    updateData((current) => ({
      ...current,
      todos: current.todos.filter((todo) => todo.id !== todoId),
    }))
  }

  function handleOpenSourceNote(noteId: string) {
    const note = appData.notes.find((item) => item.id === noteId)

    if (!note) {
      return
    }

    setActivePage('notes')
    setActiveNotebookId(note.notebookId)
    setActiveNoteId(note.id)
  }

  function handleCreateClip() {
    const trimmedContent = clipContent.trim()

    if (!trimmedContent) {
      return
    }

    const timestamp = getTimestamp()
    const clip: Clip = {
      id: createId('clip'),
      source: clipSource,
      sourceUrl: clipSourceUrl.trim() || undefined,
      rawContent: trimmedContent,
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    updateData((current) => ({
      ...current,
      clips: [clip, ...current.clips],
    }))

    setClipContent('')
    setClipSourceUrl('')
  }

  async function handleOrganizeClip(clip: Clip) {
    setOrganizingClipId(clip.id)

    try {
      const result = await organizeContent(clip.rawContent, clip.source)

      setClipAiDrafts((current) => ({
        ...current,
        [clip.id]: {
          title: result.title || buildFallbackTitle(clip.rawContent, `${clipSourceLabels[clip.source]}摘录`),
          summary: result.summary,
          tagsText: result.tags.join('、'),
          recommendedNotebookId: result.recommendedNotebookId || clip.recommendedNotebookId || 'notebook_unsorted',
        },
      }))
    } finally {
      setOrganizingClipId(null)
    }
  }

  function handleUpdateClipAiDraft(clipId: string, fields: Partial<ClipAiDraft>) {
    setClipAiDrafts((current) => {
      const draft = current[clipId]

      if (!draft) {
        return current
      }

      return {
        ...current,
        [clipId]: {
          ...draft,
          ...fields,
        },
      }
    })
  }

  function parseDraftTags(tagsText: string) {
    return tagsText
      .split(/[、,\n]/)
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 8)
  }

  function handleApplyClipAiDraft(clip: Clip) {
    const draft = clipAiDrafts[clip.id]

    if (!draft) {
      return
    }

    const timestamp = getTimestamp()
    const tags = parseDraftTags(draft.tagsText)

    updateData((current) => ({
      ...current,
      clips: current.clips.map((item) =>
        item.id === clip.id
          ? {
              ...item,
              title: draft.title.trim(),
              summary: draft.summary.trim(),
              tags,
              recommendedNotebookId: draft.recommendedNotebookId || 'notebook_unsorted',
              updatedAt: timestamp,
            }
          : item,
      ),
    }))

    setClipAiDrafts((current) => {
      const nextDrafts = { ...current }
      delete nextDrafts[clip.id]
      return nextDrafts
    })
  }

  function handleCancelClipAiDraft(clipId: string) {
    setClipAiDrafts((current) => {
      const nextDrafts = { ...current }
      delete nextDrafts[clipId]
      return nextDrafts
    })
  }

  function handleDeleteClip(clipId: string) {
    const confirmed = window.confirm('确认删除这条摘录吗？')

    if (!confirmed) {
      return
    }

    updateData((current) => ({
      ...current,
      clips: current.clips.filter((clip) => clip.id !== clipId),
      todos: current.todos.filter((todo) => todo.sourceClipId !== clipId),
    }))

    handleCancelClipAiDraft(clipId)
  }

  function handleConvertClipToNote(clip: Clip) {
    const timestamp = getTimestamp()
    const notebookId = clip.recommendedNotebookId || 'notebook_unsorted'
    const notebook = appData.notebooks.find((item) => item.id === notebookId)
    const title = clip.title || buildFallbackTitle(clip.rawContent, `${clipSourceLabels[clip.source]}摘录`)
    const recommendedNotebookName = notebook?.name ?? '待整理收集箱'
    const relatedTodos = appData.todos.filter((todo) => todo.sourceClipId === clip.id).map((todo) => todo.title)
    const contentParts = [
      '# 内容解读',
      clip.summary || '尚未生成 AI 解读。可以回到收集箱点击“AI 识别分类”。',
      '',
      '# 可执行 Todo',
      relatedTodos.length > 0 ? relatedTodos.map((todo) => `- [ ] ${todo}`).join('\n') : '- [ ] 根据这条摘录整理下一步行动',
      '',
      '# 可复用观点',
      '等待补充：把这条摘录中值得复用的观点、表达、案例或方案记录到这里。',
      '',
      '# 归档信息',
      `来源：${clipSourceLabels[clip.source]}`,
      `推荐笔记本：${recommendedNotebookName}`,
      clip.tags.length > 0 ? `标签：${clip.tags.map((tag) => `#${tag}`).join(' ')}` : '标签：暂无',
      clip.sourceUrl ? `来源链接：${clip.sourceUrl}` : '',
      '',
      '# 我的补充',
      '',
      '',
      '# 原文',
      clip.rawContent,
    ].filter(Boolean)

    const note: Note = {
      id: createId('note'),
      notebookId,
      title,
      content: contentParts.join('\n\n'),
      summary: clip.summary,
      tags: clip.tags,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    updateData((current) => ({
      ...current,
      notes: [note, ...current.notes],
    }))

    setActivePage('notes')
    setActiveNotebookId(notebook?.id ?? notebookId)
    setActiveNoteId(note.id)
  }

  async function handleGenerateReport(type: ReportType) {
    setIsGeneratingReport(true)
    setReportType(type)

    try {
      const completedTodos = appData.todos
        .filter((todo) => todo.status === 'completed')
        .slice(0, type === 'daily' ? 8 : 20)
        .map((todo) => todo.title)
      const pendingTodos = appData.todos
        .filter((todo) => todo.status === 'pending')
        .slice(0, type === 'daily' ? 8 : 20)
        .map((todo) => todo.title)
      const noteHighlights = [...appData.notes]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, type === 'daily' ? 5 : 12)
        .map((note) => note.summary || note.title || note.content.slice(0, 80))
      const clipHighlights = [...appData.clips]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, type === 'daily' ? 5 : 12)
        .map((clip) => clip.summary || clip.rawContent.slice(0, 80))
      const result = await generateReport(type, {
        completedTodos,
        pendingTodos,
        noteHighlights,
        clipHighlights,
      })

      setReportTitle(result.title)
      setReportContent(result.content)
    } finally {
      setIsGeneratingReport(false)
    }
  }

  function handleSaveReport() {
    const trimmedTitle = reportTitle.trim()
    const trimmedContent = reportContent.trim()

    if (!trimmedTitle || !trimmedContent || !reportNotebook) {
      return
    }

    const timestamp = getTimestamp()
    const note: Note = {
      id: createId('note'),
      notebookId: reportNotebook.id,
      title: trimmedTitle,
      content: trimmedContent,
      tags: [reportType === 'daily' ? '日报' : '周报', 'AI 生成'],
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    updateData((current) => ({
      ...current,
      notes: [note, ...current.notes],
    }))

    setActivePage('notes')
    setActiveNotebookId(reportNotebook.id)
    setActiveNoteId(note.id)
  }

  function handleExportData() {
    const exportPayload = {
      exportedAt: getTimestamp(),
      storageKey: getStorageKey(),
      data: appData,
    }
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `ai-notebook-backup-${getTodayDateValue()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function isImportableAppData(value: unknown): value is AppData {
    if (!value || typeof value !== 'object') {
      return false
    }

    const data = value as Partial<AppData>

    return Array.isArray(data.notebooks) && Array.isArray(data.notes) && Array.isArray(data.todos) && Array.isArray(data.clips)
  }

  function handleImportData(file: File | undefined) {
    if (!file) {
      return
    }

    const confirmed = window.confirm('导入会覆盖当前浏览器里的本地数据。建议先导出备份，再继续。确认导入吗？')

    if (!confirmed) {
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'))
        const importedData = isImportableAppData(parsed) ? parsed : parsed.data

        if (!isImportableAppData(importedData)) {
          window.alert('导入失败：这个 JSON 文件不是有效的 AI 笔记本备份。')
          return
        }

        const normalizedData = normalizeAppData(importedData)
        setAppData(normalizedData)
        setActiveNotebookId(normalizedData.notebooks[0]?.id ?? '')
        setActiveNoteId(normalizedData.notes[0]?.id ?? null)
        window.alert('导入完成，数据已恢复到当前浏览器。')
      } catch {
        window.alert('导入失败：无法解析这个 JSON 文件。')
      }
    }

    reader.readAsText(file)
  }

  function handleOpenSearchResult(result: SearchResult) {
    if (result.type === 'note') {
      setActivePage('notes')
      setActiveNotebookId(result.notebookId)
      setActiveNoteId(result.noteId)
      return
    }

    if (result.type === 'todo') {
      if (result.sourceNoteId) {
        handleOpenSourceNote(result.sourceNoteId)
        return
      }

      setActivePage('todos')
      setTodoFilter('all')
      return
    }

    setActivePage('inbox')
    setClipFilter(result.source)
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand">
          <span className="brand-mark">AI</span>
          <div>
            <p className="brand-title">小张的笔记本</p>
            <p className="brand-subtitle">个人工作与灵感中枢</p>
          </div>
        </div>

        <nav className="nav-list">
          {navigationItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === activePage ? 'nav-item active' : 'nav-item'}
              onClick={() => setActivePage(item.key)}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeContent.eyebrow}</p>
            <h1>{activeContent.title}</h1>
          </div>
          <time>{currentDate}</time>
        </header>

        {activePage === 'dashboard' ? (
          <section className="dashboard-layout">
            <form
              className="quick-capture"
              onSubmit={(event) => {
                event.preventDefault()
                handleQuickCapture()
              }}
            >
              <label htmlFor="quick-capture">快速记录</label>
              <textarea
                id="quick-capture"
                value={quickCaptureText}
                onChange={(event) => setQuickCaptureText(event.target.value)}
                placeholder="临时想法、今天要做的事、刚看到的一段灵感，都可以先丢进来..."
              />
              <div className="quick-capture-actions">
                <select
                  value={quickCaptureType}
                  onChange={(event) => setQuickCaptureType(event.target.value as QuickCaptureType)}
                >
                  <option value="note">保存为笔记</option>
                  <option value="todo">保存为今日 Todo</option>
                  <option value="clip">保存为摘录</option>
                </select>
                <button type="submit">保存</button>
              </div>
            </form>

            <section className="dashboard-stats" aria-label="数据概览">
              <div>
                <strong>{todoStats.pending}</strong>
                <span>未完成 Todo</span>
              </div>
              <div>
                <strong>{todoStats.today}</strong>
                <span>今日 Todo</span>
              </div>
              <div>
                <strong>{appData.notes.length}</strong>
                <span>笔记</span>
              </div>
              <div>
                <strong>{appData.clips.length}</strong>
                <span>摘录</span>
              </div>
            </section>

            <section className="dashboard-grid">
              <div className="dashboard-panel">
                <div className="dashboard-panel-header">
                  <strong>今日任务</strong>
                  <button type="button" onClick={() => setActivePage('todos')}>
                    查看 Todo
                  </button>
                </div>
                <div className="dashboard-list">
                  {todayTodos.length > 0 ? (
                    todayTodos.map((todo) => (
                      <button key={todo.id} type="button" className="dashboard-list-item" onClick={() => setActivePage('todos')}>
                        <span>{todo.title}</span>
                        <small>
                          {getStatusLabel(todo.status)} · {getPriorityLabel(todo.priority)}优先级
                          {todo.dueDate ? ` · ${todo.dueDate}` : ''}
                        </small>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state dashboard-empty">
                      <strong>今天还没有任务</strong>
                      <p>用上方快速记录保存一个今日 Todo。</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="dashboard-panel">
                <div className="dashboard-panel-header">
                  <strong>最近笔记</strong>
                  <button type="button" onClick={() => setActivePage('notes')}>
                    查看笔记
                  </button>
                </div>
                <div className="dashboard-list">
                  {recentNotes.length > 0 ? (
                    recentNotes.map((note) => (
                      <button
                        key={note.id}
                        type="button"
                        className="dashboard-list-item"
                        onClick={() => {
                          setActivePage('notes')
                          setActiveNotebookId(note.notebookId)
                          setActiveNoteId(note.id)
                        }}
                      >
                        <span>{note.title || '未命名笔记'}</span>
                        <small>{note.content || '暂无正文'}</small>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state dashboard-empty">
                      <strong>还没有笔记</strong>
                      <p>用快速记录保存为笔记，或进入笔记本新建。</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="dashboard-panel wide">
                <div className="dashboard-panel-header">
                  <strong>最近摘录</strong>
                  <button type="button" onClick={() => setActivePage('inbox')}>
                    查看收集箱
                  </button>
                </div>
                <div className="dashboard-list">
                  {recentClips.length > 0 ? (
                    recentClips.map((clip) => (
                      <button key={clip.id} type="button" className="dashboard-list-item" onClick={() => setActivePage('inbox')}>
                        <span>{clipSourceLabels[clip.source]}</span>
                        <small>{clip.summary || clip.rawContent}</small>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state dashboard-empty">
                      <strong>还没有摘录</strong>
                      <p>把小红书笔记或 AI 聊天内容粘贴到收集箱。</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </section>
        ) : activePage === 'notes' ? (
          <section className="notes-page-layout">
          <section className="notes-layout">
            <aside className="notebook-pane" aria-label="笔记本列表">
              <div className="pane-header">
                <div>
                  <strong>笔记本</strong>
                  <span>{appData.notebooks.length} 个</span>
                </div>
                <button type="button" onClick={handleCreateNotebook}>
                  新建
                </button>
              </div>
              <div className="notebook-list">
                {appData.notebooks.map((notebook) => {
                  const noteCount = appData.notes.filter((note) => note.notebookId === notebook.id).length

                  return (
                    <button
                      key={notebook.id}
                      type="button"
                      className={notebook.id === activeNotebookId ? 'notebook-item active' : 'notebook-item'}
                      onClick={() => handleSelectNotebook(notebook.id)}
                    >
                      <span>{notebook.name}</span>
                      <small>
                        {noteCount} 条笔记
                        {notebook.description ? ` · ${notebook.description}` : ''}
                      </small>
                      <span className="notebook-item-actions">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleRenameNotebook(notebook)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              event.stopPropagation()
                              handleRenameNotebook(notebook)
                            }
                          }}
                        >
                          重命名
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleUpdateNotebookDescription(notebook)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              event.stopPropagation()
                              handleUpdateNotebookDescription(notebook)
                            }
                          }}
                        >
                          描述
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {activeNotebook ? (
                <div className="notebook-actions">
                  <button type="button" className="danger-button" onClick={() => handleDeleteNotebook(activeNotebook)}>
                    删除当前空笔记本
                  </button>
                </div>
              ) : null}
            </aside>

            <aside className="note-list-pane" aria-label="笔记列表">
              <div className="pane-header">
                <div>
                  <strong>{activeNotebook?.name ?? '未选择笔记本'}</strong>
                  <span>{notesInActiveNotebook.length} 条笔记</span>
                </div>
                <button type="button" onClick={handleCreateNote}>
                  新建
                </button>
              </div>
              <div className="note-list">
                {notesInActiveNotebook.length > 0 ? (
                  notesInActiveNotebook.map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      className={note.id === activeNoteId ? 'note-item active' : 'note-item'}
                      onClick={() => setActiveNoteId(note.id)}
                    >
                      <span>{note.title || '未命名笔记'}</span>
                      <small>{note.content || '暂无正文'}</small>
                    </button>
                  ))
                ) : (
                  <div className="empty-state">
                    <strong>还没有笔记</strong>
                    <p>点击“新建”创建这个笔记本里的第一条笔记。</p>
                  </div>
                )}
              </div>
            </aside>

            <section className="editor-pane" aria-label="笔记编辑区">
              {activeNote ? (
                <>
                  <div className="editor-toolbar">
                    <select
                      value={activeNote.notebookId}
                      onChange={(event) => handleUpdateNote(activeNote.id, { notebookId: event.target.value })}
                    >
                      {appData.notebooks.map((notebook) => (
                        <option key={notebook.id} value={notebook.id}>
                          {notebook.name}
                        </option>
                      ))}
                    </select>
                    <div className="editor-toolbar-actions">
                      <button
                        type="button"
                        onClick={() => void handleOrganizeNoteFully(activeNote)}
                        disabled={organizingNoteId === activeNote.id}
                      >
                        {organizingNoteId === activeNote.id ? '整理中...' : 'AI 整理归类'}
                      </button>
                      <button type="button" className="danger-button" onClick={() => handleDeleteNote(activeNote.id)}>
                        删除
                      </button>
                    </div>
                  </div>
                  <input
                    className="note-title-input"
                    value={activeNote.title}
                    onChange={(event) => handleUpdateNote(activeNote.id, { title: event.target.value })}
                    placeholder="笔记标题"
                  />
                  {(activeNote.summary || activeNote.tags.length > 0) && (
                    <section className="note-ai-result">
                      {activeNote.summary ? (
                        <div>
                          <strong>AI 摘要</strong>
                          <p>{activeNote.summary}</p>
                        </div>
                      ) : null}
                      {activeNote.tags.length > 0 ? (
                        <div>
                          <strong>标签</strong>
                          <p>{activeNote.tags.map((tag) => `#${tag}`).join(' ')}</p>
                        </div>
                      ) : null}
                    </section>
                  )}
                  <textarea
                    className="note-content-input"
                    value={activeNote.content}
                    onChange={(event) => handleUpdateNote(activeNote.id, { content: event.target.value })}
                    placeholder="开始记录工作内容、灵感、会议纪要或 AI 对话摘录..."
                  />
                  <div className="markdown-hint">
                    <span>Todo 写法：</span>
                    <code>- [ ] [高] [2026-05-27] 整理会议纪要</code>
                    <code>- [ ] [中] 跟进用户反馈</code>
                    <code>- [x] [低] [2026-05-26] 归档会议纪要</code>
                    <span>优先级和截止日期都可省略；不写优先级时默认中优先级。</span>
                  </div>
                  <footer className="editor-meta">
                    <span>创建：{new Date(activeNote.createdAt).toLocaleString('zh-CN')}</span>
                    <span>更新：{new Date(activeNote.updatedAt).toLocaleString('zh-CN')}</span>
                  </footer>
                </>
              ) : (
                <div className="empty-editor">
                  <strong>选择或新建一条笔记</strong>
                  <p>Milestone 2 已支持笔记本、笔记列表、编辑和本地保存。</p>
                  <button type="button" onClick={handleCreateNote}>
                    新建笔记
                  </button>
                </div>
              )}
            </section>
            </section>
          </section>
        ) : activePage === 'todos' ? (
          <section className="todo-layout">
            <form
              className="todo-composer"
              onSubmit={(event) => {
                event.preventDefault()
                handleCreateTodo()
              }}
            >
              <div>
                <label htmlFor="todo-title">新建 Todo</label>
                <input
                  id="todo-title"
                  value={newTodoTitle}
                  onChange={(event) => setNewTodoTitle(event.target.value)}
                  placeholder="输入今天要完成的任务..."
                />
              </div>
              <div className="todo-form-grid">
                <label>
                  优先级
                  <select
                    value={newTodoPriority}
                    onChange={(event) => setNewTodoPriority(event.target.value as TodoPriority)}
                  >
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                  </select>
                </label>
                <label>
                  截止日期
                  <input
                    type="date"
                    value={newTodoDueDate}
                    onChange={(event) => setNewTodoDueDate(event.target.value)}
                  />
                </label>
                <label>
                  关联笔记
                  <select value={newTodoSourceNoteId} onChange={(event) => setNewTodoSourceNoteId(event.target.value)}>
                    <option value="">不关联</option>
                    {appData.notes.map((note) => (
                      <option key={note.id} value={note.id}>
                        {note.title || '未命名笔记'}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">添加 Todo</button>
              </div>
            </form>

            <section className="todo-board">
              <aside className="todo-filters" aria-label="Todo 筛选">
                {[
                  ['pending', '未完成', todoStats.pending],
                  ['today', '今天', todoStats.today],
                  ['overdue', '逾期', todoStats.overdue],
                  ['from_notes', '来自笔记', todoStats.fromNotes],
                  ['completed', '已完成', todoStats.completed],
                  ['all', '全部', todoStats.all],
                ].map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    className={todoFilter === key ? 'todo-filter active' : 'todo-filter'}
                    onClick={() => setTodoFilter(key as TodoFilter)}
                  >
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </button>
                ))}
              </aside>

              <div className="todo-list-panel">
                <div className="todo-list-header">
                  <div>
                    <strong>Todo 列表</strong>
                    <span>{filteredTodos.length} 条结果</span>
                  </div>
                </div>

                <div className="todo-list">
                  {filteredTodos.length > 0 ? (
                    filteredTodos.map((todo) => {
                      const sourceNote = todo.sourceNoteId
                        ? appData.notes.find((note) => note.id === todo.sourceNoteId)
                        : null

                      return (
                        <article
                          key={todo.id}
                          className={`todo-item priority-${todo.priority} ${todo.status === 'completed' ? 'completed' : ''}`}
                        >
                          <div className="todo-main-row">
                            <button
                              type="button"
                              className="check-button"
                              aria-label={todo.status === 'completed' ? '标记为未完成' : '标记为完成'}
                              onClick={() => handleToggleTodo(todo.id)}
                            >
                              {todo.status === 'completed' ? '✓' : ''}
                            </button>
                            <input
                              value={todo.title}
                              onChange={(event) => handleUpdateTodo(todo.id, { title: event.target.value })}
                              aria-label="Todo 标题"
                            />
                            <button type="button" className="danger-button" onClick={() => handleDeleteTodo(todo.id)}>
                              删除
                            </button>
                          </div>

                          <div className="todo-meta-row">
                            <label>
                              状态
                              <span>{getStatusLabel(todo.status)}</span>
                            </label>
                            <label>
                              优先级
                              <select
                                value={todo.priority}
                                onChange={(event) =>
                                  handleUpdateTodo(todo.id, { priority: event.target.value as TodoPriority })
                                }
                              >
                                <option value="high">高</option>
                                <option value="medium">中</option>
                                <option value="low">低</option>
                              </select>
                            </label>
                            <label>
                              截止
                              <input
                                type="date"
                                value={todo.dueDate ?? ''}
                                onChange={(event) => handleUpdateTodo(todo.id, { dueDate: event.target.value })}
                              />
                            </label>
                            <label>
                              来源
                              <select
                                value={todo.sourceNoteId ?? ''}
                                onChange={(event) => handleUpdateTodo(todo.id, { sourceNoteId: event.target.value })}
                              >
                                <option value="">无</option>
                                {appData.notes.map((note) => (
                                  <option key={note.id} value={note.id}>
                                    {note.title || '未命名笔记'}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <div className="todo-foot-row">
                            <span className={`priority-badge priority-${todo.priority}`}>
                              {getPriorityLabel(todo.priority)}优先级
                            </span>
                            {todo.dueDate ? (
                              <span className={isTodoOverdue(todo) ? 'overdue-text' : ''}>截止 {todo.dueDate}</span>
                            ) : (
                              <span>未设置截止日期</span>
                            )}
                            {sourceNote ? (
                              <button type="button" onClick={() => handleOpenSourceNote(sourceNote.id)}>
                                打开来源笔记：{sourceNote.title || '未命名笔记'}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      )
                    })
                  ) : (
                    <div className="empty-state todo-empty">
                      <strong>没有符合条件的 Todo</strong>
                      <p>可以在上方新建任务，或者切换左侧筛选条件。</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </section>
        ) : activePage === 'inbox' ? (
          <section className="inbox-layout">
            <form
              className="clip-composer"
              onSubmit={(event) => {
                event.preventDefault()
                handleCreateClip()
              }}
            >
              <div className="clip-input-area">
                <label htmlFor="clip-content">粘贴摘录内容</label>
                <textarea
                  id="clip-content"
                  value={clipContent}
                  onChange={(event) => setClipContent(event.target.value)}
                  placeholder="直接粘贴小红书笔记、AI 聊天内容、微信或飞书消息..."
                />
              </div>
              <div className="clip-form-grid">
                <label>
                  来源
                  <select value={clipSource} onChange={(event) => setClipSource(event.target.value as ClipSource)}>
                    {Object.entries(clipSourceLabels).map(([source, label]) => (
                      <option key={source} value={source}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  来源链接
                  <input
                    value={clipSourceUrl}
                    onChange={(event) => setClipSourceUrl(event.target.value)}
                    placeholder="可选"
                  />
                </label>
                <button type="submit">保存摘录</button>
              </div>
            </form>

            <section className="clip-board">
              <aside className="clip-filters" aria-label="摘录来源筛选">
                <button
                  type="button"
                  className={clipFilter === 'all' ? 'clip-filter active' : 'clip-filter'}
                  onClick={() => setClipFilter('all')}
                >
                  <span>全部</span>
                  <strong>{appData.clips.length}</strong>
                </button>
                {Object.entries(clipSourceLabels).map(([source, label]) => {
                  const count = appData.clips.filter((clip) => clip.source === source).length

                  return (
                    <button
                      key={source}
                      type="button"
                      className={clipFilter === source ? 'clip-filter active' : 'clip-filter'}
                      onClick={() => setClipFilter(source as ClipSource)}
                    >
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </button>
                  )
                })}
              </aside>

              <div className="clip-list-panel">
                <div className="todo-list-header">
                  <div>
                    <strong>摘录列表</strong>
                    <span>{filteredClips.length} 条结果</span>
                  </div>
                </div>

                <div className="clip-list">
                  {filteredClips.length > 0 ? (
                    filteredClips.map((clip) => {
                      const recommendedNotebook = clip.recommendedNotebookId
                        ? appData.notebooks.find((notebook) => notebook.id === clip.recommendedNotebookId)
                        : null
                      const aiDraft = clipAiDrafts[clip.id]

                      return (
                        <article key={clip.id} className="clip-item">
                          <header className="clip-item-header">
                            <div>
                              <strong>{clipSourceLabels[clip.source]}</strong>
                              <span>{new Date(clip.createdAt).toLocaleString('zh-CN')}</span>
                            </div>
                            <button type="button" className="danger-button" onClick={() => handleDeleteClip(clip.id)}>
                              删除
                            </button>
                          </header>

                          <p className="clip-raw-content">{clip.rawContent}</p>

                          {clip.sourceUrl ? (
                            <a className="clip-source-link" href={clip.sourceUrl} target="_blank" rel="noreferrer">
                              {clip.sourceUrl}
                            </a>
                          ) : null}

                          <div className="clip-ai-box">
                            <div>
                              <strong>建议标题</strong>
                              <p>{clip.title || '尚未生成标题'}</p>
                            </div>
                            <div>
                              <strong>AI 识别摘要</strong>
                              <p>{clip.summary || '尚未整理。点击“AI 识别分类”生成摘要、标签和推荐笔记本。'}</p>
                            </div>
                            <div>
                              <strong>推荐分类</strong>
                              <p>{recommendedNotebook?.name ?? '暂无推荐'}</p>
                            </div>
                            <div>
                              <strong>标签</strong>
                              <p>{clip.tags.length > 0 ? clip.tags.map((tag) => `#${tag}`).join(' ') : '暂无标签'}</p>
                            </div>
                          </div>

                          {aiDraft ? (
                            <div className="clip-ai-draft">
                              <div className="clip-ai-draft-header">
                                <div>
                                  <strong>AI 草稿待确认</strong>
                                  <span>可编辑后再采纳，避免 AI 直接写入不满意的结果。</span>
                                </div>
                                <button type="button" className="danger-button" onClick={() => handleCancelClipAiDraft(clip.id)}>
                                  放弃草稿
                                </button>
                              </div>

                              <label>
                                建议标题
                                <input
                                  value={aiDraft.title}
                                  onChange={(event) => handleUpdateClipAiDraft(clip.id, { title: event.target.value })}
                                  placeholder="转为笔记时默认使用这个标题"
                                />
                              </label>

                              <label>
                                解读正文
                                <textarea
                                  value={aiDraft.summary}
                                  onChange={(event) => handleUpdateClipAiDraft(clip.id, { summary: event.target.value })}
                                />
                              </label>

                              <div className="clip-ai-draft-grid">
                                <label>
                                  推荐笔记本
                                  <select
                                    value={aiDraft.recommendedNotebookId}
                                    onChange={(event) =>
                                      handleUpdateClipAiDraft(clip.id, { recommendedNotebookId: event.target.value })
                                    }
                                  >
                                    {appData.notebooks.map((notebook) => (
                                      <option key={notebook.id} value={notebook.id}>
                                        {notebook.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label>
                                  标签
                                  <input
                                    value={aiDraft.tagsText}
                                    onChange={(event) => handleUpdateClipAiDraft(clip.id, { tagsText: event.target.value })}
                                    placeholder="用顿号、逗号或换行分隔"
                                  />
                                </label>
                              </div>

                              <div className="clip-actions">
                                <button type="button" onClick={() => handleApplyClipAiDraft(clip)}>
                                  采纳并写入
                                </button>
                                <button type="button" onClick={() => handleConvertClipToNote(clip)}>
                                  先转为笔记
                                </button>
                              </div>
                            </div>
                          ) : null}

                          <div className="clip-actions">
                            <button
                              type="button"
                              onClick={() => void handleOrganizeClip(clip)}
                              disabled={organizingClipId === clip.id}
                            >
                              {organizingClipId === clip.id ? '识别中...' : 'AI 识别分类'}
                            </button>
                            <button type="button" onClick={() => handleConvertClipToNote(clip)}>
                              转为笔记
                            </button>
                          </div>
                        </article>
                      )
                    })
                  ) : (
                    <div className="empty-state todo-empty">
                      <strong>还没有摘录</strong>
                      <p>先在上方粘贴一条小红书笔记或 AI 聊天内容。</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </section>
        ) : activePage === 'assistant' ? (
          <section className="report-layout">
            <section className="report-controls">
              <div>
                <strong>生成报告</strong>
                <p>基于当前 Todo、笔记和摘录生成可编辑的日报/周报草稿。</p>
              </div>
              <div className="report-actions">
                <button
                  type="button"
                  onClick={() => void handleGenerateReport('daily')}
                  disabled={isGeneratingReport}
                >
                  {isGeneratingReport && reportType === 'daily' ? '生成中...' : '生成日报'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerateReport('weekly')}
                  disabled={isGeneratingReport}
                >
                  {isGeneratingReport && reportType === 'weekly' ? '生成中...' : '生成周报'}
                </button>
              </div>
            </section>

            <section className="report-editor">
              <div className="report-title-row">
                <input
                  value={reportTitle}
                  onChange={(event) => setReportTitle(event.target.value)}
                  placeholder="报告标题"
                />
                <button type="button" onClick={handleSaveReport} disabled={!reportTitle.trim() || !reportContent.trim()}>
                  保存到日报周报
                </button>
              </div>
              <textarea
                value={reportContent}
                onChange={(event) => setReportContent(event.target.value)}
                placeholder="点击上方生成日报或周报，这里会出现可编辑草稿。"
              />
              <footer className="report-meta">
                <span>保存位置：{reportNotebook?.name ?? '暂无笔记本'}</span>
                <span>数据源：{appData.todos.length} 个 Todo / {appData.notes.length} 条笔记 / {appData.clips.length} 条摘录</span>
              </footer>
            </section>

            <section className="data-sync-panel">
              <div className="data-sync-copy">
                <strong>数据与同步</strong>
                <p>
                  当前笔记会自动保存在这个浏览器的 localStorage：
                  <code>{getStorageKey()}</code>
                  。刷新页面仍会保留；但换电脑、换浏览器或清理浏览器数据后，本地数据可能不可见。
                </p>
                <p>
                  Milestone 13 已接入 Supabase 云同步基础能力。当前采用手动同步：先登录，再选择上传本地数据或从云端拉取。
                </p>
                <p className="cloud-status">{cloudStatus}</p>
              </div>
              <div className="data-sync-actions">
                <button type="button" onClick={handleExportData}>
                  导出 JSON 备份
                </button>
                <label className="import-button">
                  导入 JSON
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => {
                      handleImportData(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                </label>
              </div>
            </section>

            <section className="cloud-sync-panel">
              <div className="cloud-sync-form">
                <strong>Supabase 云同步</strong>
                <p>首次使用前，请在 Supabase SQL Editor 创建 `notebook_data` 表，并在 `.env` 填入 URL 和 anon key。</p>
                <label>
                  邮箱
                  <input
                    type="email"
                    value={cloudEmail}
                    onChange={(event) => setCloudEmail(event.target.value)}
                    placeholder="you@example.com"
                    disabled={isCloudSyncing}
                  />
                </label>
                <label>
                  密码
                  <input
                    type="password"
                    value={cloudPassword}
                    onChange={(event) => setCloudPassword(event.target.value)}
                    placeholder="至少 6 位"
                    disabled={isCloudSyncing}
                  />
                </label>
              </div>
              <div className="cloud-sync-actions">
                <button
                  type="button"
                  onClick={() => void handleCloudAuth('sign_in')}
                  disabled={isCloudSyncing || !cloudSyncState.configured}
                >
                  登录
                </button>
                <button
                  type="button"
                  onClick={() => void handleCloudAuth('sign_up')}
                  disabled={isCloudSyncing || !cloudSyncState.configured}
                >
                  注册
                </button>
                <button type="button" onClick={() => void handleCloudSignOut()} disabled={isCloudSyncing || !cloudSyncState.user}>
                  退出
                </button>
                <button
                  type="button"
                  onClick={() => void handleDiagnoseCloudSync()}
                  disabled={isCloudSyncing || !cloudSyncState.user}
                >
                  诊断连接
                </button>
                <button
                  type="button"
                  onClick={() => void handleUploadLocalDataToCloud()}
                  disabled={isCloudSyncing || !cloudSyncState.user}
                >
                  上传本地到云端
                </button>
                <button
                  type="button"
                  onClick={() => void handleLoadCloudDataToLocal()}
                  disabled={isCloudSyncing || !cloudSyncState.user}
                >
                  从云端恢复到本地
                </button>
              </div>
            </section>
          </section>
        ) : activePage === 'search' ? (
          <section className="search-layout">
            <div className="search-box">
              <label htmlFor="global-search">搜索内容</label>
              <input
                id="global-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="输入关键词，搜索笔记、Todo、摘录、摘要和标签..."
              />
              <span>{normalizedSearchQuery ? `${searchResults.length} 条结果` : '请输入关键词开始搜索'}</span>
            </div>

            <section className="search-results">
              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="search-result-item"
                    onClick={() => handleOpenSearchResult(result)}
                  >
                    <span className={`search-type ${result.type}`}>
                      {result.type === 'note' ? '笔记' : result.type === 'todo' ? 'Todo' : '摘录'}
                    </span>
                    <div>
                      <strong>{result.title}</strong>
                      <p>{result.excerpt}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="empty-state search-empty">
                  <strong>{normalizedSearchQuery ? '没有找到结果' : '等待搜索'}</strong>
                  <p>{normalizedSearchQuery ? '换个关键词试试。' : '可以搜索标题、正文、摘要、标签、Todo 和摘录内容。'}</p>
                </div>
              )}
            </section>
          </section>
        ) : (
          <section className="preview-panel">
            <div className="panel-copy">
              <p>{activeContent.body}</p>
              <div className="action-row">
                {activeContent.actions.map((action) => (
                  <button key={action} type="button">
                    {action}
                  </button>
                ))}
              </div>
            </div>
            <div className="status-board" aria-label="MVP 状态">
              <div>
                <strong>当前阶段</strong>
                <span>Milestone 2 笔记本和笔记编辑</span>
              </div>
              <div>
                <strong>下一步</strong>
                <span>实现 Todo 管理</span>
              </div>
              <div>
                <strong>数据策略</strong>
                <span>笔记数据已写入本地 localStorage</span>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

export default App
