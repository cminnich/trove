import type { Database } from './database'

type Item = Database['public']['Tables']['items']['Row']
type Collection = Database['public']['Tables']['collections']['Row']

// Main state machine for Context-First Capture flow
export type CaptureState =
  | { stage: 'initializing'; url: string }
  | { stage: 'capturing'; url: string; extraction: ExtractionState }
  | { stage: 'saving'; url: string; item: Item; context: CaptureContext }
  | { stage: 'complete'; item: Item; collections: string[] }
  | { stage: 'error'; error: string; canRetry: boolean }

// Extraction state tracks background AI processing
export type ExtractionState =
  | { status: 'pending' }
  | { status: 'in_progress'; progress: number } // 0-100
  | { status: 'complete'; item: Item; needsReview: boolean }
  | { status: 'failed'; error: string }

// User-provided context (notes + collection assignments)
export type CaptureContext = {
  notes: string
  selectedCollections: string[] // collection IDs
  isDirty: boolean // user has made changes
}

// Save intent tracks race condition state
export type SaveIntent =
  | { type: 'none' }
  | { type: 'pending'; context: CaptureContext } // user saved before extraction complete
  | { type: 'ready'; context: CaptureContext }   // extraction complete, ready to save

// API response types
export interface ItemWithContext {
  item: Item
  collections: string[]
}

export interface CreateItemRequest {
  url: string
  collections?: CollectionAssignment[]
}

export interface UpdateItemRequest {
  itemId: string
  collections: CollectionAssignment[]
}

export interface CollectionAssignment {
  id: string
  position?: number | null
  notes?: string
}

// Helper type guards
export function isExtractionComplete(state: ExtractionState): state is Extract<ExtractionState, { status: 'complete' }> {
  return state.status === 'complete'
}

export function isExtractionFailed(state: ExtractionState): state is Extract<ExtractionState, { status: 'failed' }> {
  return state.status === 'failed'
}

export function isExtractionInProgress(state: ExtractionState): state is Extract<ExtractionState, { status: 'in_progress' }> {
  return state.status === 'in_progress'
}

export function hasSaveIntent(intent: SaveIntent): intent is Exclude<SaveIntent, { type: 'none' }> {
  return intent.type !== 'none'
}
