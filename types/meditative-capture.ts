import type { Database } from './database'

type Item = Database['public']['Tables']['items']['Row']
type Collection = Database['public']['Tables']['collections']['Row']

// =============================================================================
// Core State Machine
// =============================================================================

/**
 * MeditativeCaptureState - The 4-phase meditative capture flow
 *
 * 1. Arrival: Item saved, Seed appears in void
 * 2. Spatial: Galaxy view for collection placement
 * 3. Inquiry: Socratic dialogue after placement
 * 4. Completion: Success bloom, synthesized notes
 */
export type MeditativeCaptureState =
  | { phase: 'arrival'; url: string; itemId: string; seed: SeedState }
  | { phase: 'spatial'; url: string; itemId: string; item: Item; galaxy: GalaxyState; seed: SeedState }
  | { phase: 'inquiry'; url: string; itemId: string; item: Item; placement: PlacementResult; dialogue: DialogueState }
  | { phase: 'completion'; item: Item; collection: Collection; synthesizedNotes: StructuredNotes }
  | { phase: 'departed' } // User left early, item in Inbox
  | { phase: 'error'; error: string; canRetry: boolean }

// =============================================================================
// Seed (The new item being placed)
// =============================================================================

export type ExtractionStatus =
  | { status: 'pending' }
  | { status: 'in_progress'; progress: number }
  | { status: 'complete'; item: Item }
  | { status: 'failed'; error: string }

export interface SeedState {
  /** Current extraction status */
  extraction: ExtractionStatus
  /** Position in the Galaxy canvas (relative to center) */
  position: Vec2
  /** Whether the user is currently dragging the Seed */
  isDragging: boolean
  /** Velocity for physics simulation */
  velocity: Vec2
  /** Image URL (if extracted) */
  imageUrl?: string
  /** Title (if extracted) */
  title?: string
}

// =============================================================================
// Galaxy (Spatial visualization)
// =============================================================================

export interface GalaxyState {
  /** All collection clusters (Nebulae) */
  nebulae: Nebula[]
  /** Theme connections between nebulae */
  edges: NebulaEdge[]
  /** Current view transform (pan/zoom) */
  viewTransform: ViewTransform
  /** ID of the nearest nebula to the Seed */
  nearestNebula?: string
  /** Whether in "create new nebula" mode */
  isCreatingNebula: boolean
  /** Position where long-press started (for new nebula creation) */
  longPressPosition?: Vec2
}

export interface Nebula {
  /** Collection ID */
  id: string
  /** Collection name */
  name: string
  /** Collection type */
  type: 'inbox' | 'wishlist' | 'inventory' | 'research' | 'default'
  /** Position in Galaxy space */
  position: Vec2
  /** Radius based on item count */
  radius: number
  /** Number of items in this collection */
  itemCount: number
  /** Theme color(s) derived from collection */
  themeColors: [string, string]
  /** Key themes from AI overview */
  themes: string[]
  /** Sample items (for showing related items during placement) */
  sampleItems: NebulaItem[]
  /** Whether this nebula is being hovered/approached */
  isActive: boolean
  /** Gravitational pull strength (increases when Seed approaches) */
  gravitationalPull: number
}

export interface NebulaItem {
  id: string
  title: string
  imageUrl?: string
  /** Similarity score to the current Seed (0-1) */
  similarity?: number
}

export interface NebulaEdge {
  /** Source nebula ID */
  source: string
  /** Target nebula ID */
  target: string
  /** Relationship strength (0-1) */
  strength: number
  /** Label describing the connection */
  label?: string
}

export interface ViewTransform {
  x: number
  y: number
  scale: number
}

// =============================================================================
// Placement Result
// =============================================================================

export interface PlacementResult {
  /** The collection where the Seed was placed */
  collectionId: string
  /** Collection details */
  collection: Collection
  /** Items that "drifted" toward the Seed during placement */
  relatedItems: NebulaItem[]
  /** Final position where the Seed landed */
  position: Vec2
}

// =============================================================================
// Socratic Dialogue
// =============================================================================

export interface DialogueState {
  /** The questions to ask */
  questions: SocraticQuestion[]
  /** Current question index */
  currentIndex: number
  /** Answers keyed by question ID */
  answers: Record<string, string>
  /** Whether the AI is currently "typing" */
  isTyping: boolean
  /** Whether all questions have been answered */
  isComplete: boolean
}

export interface SocraticQuestion {
  id: string
  /** The question text */
  text: string
  /** Question type determines the UI */
  type: 'open' | 'choice' | 'scale'
  /** Options for choice questions */
  options?: string[]
  /** Labels for scale endpoints [min, max] */
  scaleLabels?: [string, string]
  /** Why this question is being asked (shown subtly) */
  context?: string
}

// =============================================================================
// Structured Notes
// =============================================================================

export interface StructuredNotes {
  /** Human-readable summary of the notes */
  raw_text: string
  /** Detected intent for saving this item */
  intent: 'gift' | 'purchase' | 'research' | 'inspiration' | 'collection' | 'other'
  /** Related item IDs mentioned or connected */
  connections: string[]
  /** Key attributes extracted from dialogue */
  key_attributes: Record<string, string>
  /** Raw question/answer pairs */
  reflection_answers: Array<{ question: string; answer: string }>
}

/**
 * Parse notes from database (backwards compatible)
 * Handles both legacy plain strings and new structured JSON
 */
export function parseNotes(notes: string | null): StructuredNotes | null {
  if (!notes) return null

  try {
    const parsed = JSON.parse(notes)
    if (typeof parsed === 'object' && parsed.raw_text) {
      return parsed as StructuredNotes
    }
  } catch {
    // Not JSON, treat as legacy plain text
  }

  // Legacy format: plain string
  return {
    raw_text: notes,
    intent: 'collection',
    connections: [],
    key_attributes: {},
    reflection_answers: [],
  }
}

/**
 * Serialize structured notes for database storage
 */
export function serializeNotes(notes: StructuredNotes): string {
  return JSON.stringify(notes)
}

// =============================================================================
// Utility Types
// =============================================================================

export interface Vec2 {
  x: number
  y: number
}

// Vector math utilities
export const vec2 = {
  add: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y }),
  mul: (v: Vec2, s: number): Vec2 => ({ x: v.x * s, y: v.y * s }),
  div: (v: Vec2, s: number): Vec2 => ({ x: v.x / s, y: v.y / s }),
  len: (v: Vec2): number => Math.sqrt(v.x * v.x + v.y * v.y),
  normalize: (v: Vec2): Vec2 => {
    const l = vec2.len(v)
    return l === 0 ? { x: 0, y: 0 } : vec2.div(v, l)
  },
  dist: (a: Vec2, b: Vec2): number => vec2.len(vec2.sub(a, b)),
  zero: (): Vec2 => ({ x: 0, y: 0 }),
}

// =============================================================================
// Type Guards
// =============================================================================

export function isArrivalPhase(
  state: MeditativeCaptureState
): state is Extract<MeditativeCaptureState, { phase: 'arrival' }> {
  return state.phase === 'arrival'
}

export function isSpatialPhase(
  state: MeditativeCaptureState
): state is Extract<MeditativeCaptureState, { phase: 'spatial' }> {
  return state.phase === 'spatial'
}

export function isInquiryPhase(
  state: MeditativeCaptureState
): state is Extract<MeditativeCaptureState, { phase: 'inquiry' }> {
  return state.phase === 'inquiry'
}

export function isCompletionPhase(
  state: MeditativeCaptureState
): state is Extract<MeditativeCaptureState, { phase: 'completion' }> {
  return state.phase === 'completion'
}

export function isExtractionComplete(
  status: ExtractionStatus
): status is Extract<ExtractionStatus, { status: 'complete' }> {
  return status.status === 'complete'
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface GenerateSocraticQuestionsRequest {
  itemId: string
  collectionId: string
  extractedMetadata?: {
    title?: string
    type?: string
    attributes?: Record<string, unknown>
  }
}

export interface GenerateSocraticQuestionsResponse {
  questions: SocraticQuestion[]
}

export interface SynthesizeNotesRequest {
  itemId: string
  collectionId: string
  questions: SocraticQuestion[]
  answers: Record<string, string>
}

export interface SynthesizeNotesResponse {
  structuredNotes: StructuredNotes
}

export interface GalaxyDataRequest {
  userId: string
}

export interface GalaxyDataResponse {
  nebulae: Nebula[]
  edges: NebulaEdge[]
}
