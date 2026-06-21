import type { AppData, Notebook } from '../types/domain'

const now = new Date().toISOString()

export const defaultNotebooks: Notebook[] = [
  {
    id: 'notebook_work',
    name: '工作记录',
    description: '日常工作相关笔记',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'notebook_inspiration',
    name: '灵感收集',
    description: '未经整理的灵感和想法',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'notebook_ai_chats',
    name: 'AI 对话摘录',
    description: '来自 AI 聊天的有价值内容',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'notebook_xiaohongshu',
    name: '小红书灵感',
    description: '小红书内容和选题灵感',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'notebook_reports',
    name: '日报周报',
    description: '自动生成或手动整理的报告',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'notebook_unsorted',
    name: '待整理收集箱',
    description: '暂未分类的内容',
    createdAt: now,
    updatedAt: now,
  },
]

export const defaultAppData: AppData = {
  notebooks: defaultNotebooks,
  notes: [],
  todos: [],
  clips: [],
}
