export interface Note {
  id: number
  created_at: string
  updated_at: string
  title: string
  content: string
  tags: string       // JSON array
  linked_iocs: string        // JSON array of IDs
  linked_techniques: string  // JSON array
  linked_cves: string        // JSON array
  created_by: string
}

export interface NoteCreateRequest {
  title: string
  content?: string
  tags?: string
  linked_iocs?: string
  linked_techniques?: string
  linked_cves?: string
}

export interface NotesResponse {
  notes: Note[]
  total: number
}
