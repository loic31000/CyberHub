// Types pour la couche d'annotation CLOAK — séparée du contenu source.
// ⚠️ Le framework CLOAK original est en lecture seule ; seules ces annotations sont éditables.

export type AnnotationStatus = 'a_tester' | 'vu_en_lab' | 'maitrise' | ''

export interface CloakAnnotation {
  id: number
  technique_ref: string   // ex: "tac-3:te-9" ou "tac-3:te-9:sub-2"
  user_notes: string      // markdown libre
  status: AnnotationStatus
  counter_notes: string   // contre-mesures personnelles (markdown)
  tags: string            // CSV ou JSON array
  created_at: string
  updated_at: string
}

export interface CloakAnnotationRequest {
  technique_ref: string
  user_notes: string
  status: AnnotationStatus
  counter_notes: string
  tags: string
}

/** Map technique_ref → annotation pour accès O(1) dans CLOAKPage */
export type AnnotationMap = Map<string, CloakAnnotation>
