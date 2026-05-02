// ====================================================
// Types TypeScript stricts — CLOAK Framework
// Concealment Layers for Online Anonymity and Knowledge
// https://github.com/Mickinthemiddle/CLOAK
// ====================================================

export type CloakType = 'Technical' | 'Behavioral' | 'Physical' | ''

export interface CloakProcedure {
  id: number | string   // peut être "TTP-XXX" ou number
  name: string
  description: string
  type: CloakType | string
}

export interface CloakSubTechnique {
  id: number
  name: string
  description: string
  type: CloakType | string
  procedures: CloakProcedure[]
}

export interface CloakTechnique {
  id: number
  name: string
  description: string
  type: CloakType | string
  procedures: CloakProcedure[]
  subtechniques: CloakSubTechnique[]
}

export interface CloakTactic {
  id: number
  name: string
  description: string
  type: CloakType | string
  techniques: CloakTechnique[]
}

export interface CloakData {
  tactics: CloakTactic[]
}

// Vue aplatie pour la recherche et l'affichage
export interface CloakFlatItem {
  kind: 'technique' | 'subtechnique' | 'procedure'
  tacticId: number
  tacticName: string
  techniqueId: number
  techniqueName: string
  subId?: number
  subName?: string
  id: number | string
  name: string
  description: string
  type: CloakType | string
  procedures?: CloakProcedure[]
}
