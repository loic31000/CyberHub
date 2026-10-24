import type { CTFWriteup } from '@/types'

export function makeCTF(id = 1, overrides: Partial<CTFWriteup> = {}): CTFWriteup {
  return {
    id,
    title: `Challenge ${id}`,
    platform: 'HackTheBox',
    machine_name: `Machine ${id}`,
    difficulty: 'medium',
    category: 'web',
    content: 'Writeup content',
    flags: '',
    tags: '',
    completed: false,
    created_at: '2026-10-24T10:00:00Z',
    updated_at: '2026-10-24T10:00:00Z',
    ...overrides,
  }
}
