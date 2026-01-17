import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { callClaudeJSON, loadPrompt, replaceVars } from '@/lib/ai'
import { getAuthenticatedServerClient } from '@/lib/supabase-server'
import type { StructuredNotes, SocraticQuestion } from '@/types/meditative-capture'

// Types for Supabase query results
type ItemSelect = {
  title: string | null
  item_type: string | null
  brand: string | null
}

type CollectionSelect = {
  name: string
  type: string | null
}

// Request schema
const RequestSchema = z.object({
  itemId: z.string().uuid(),
  collectionId: z.string().uuid(),
  questions: z.array(z.object({
    id: z.string(),
    text: z.string(),
    type: z.enum(['choice', 'open', 'scale']),
    options: z.array(z.string()).optional(),
    scaleLabels: z.tuple([z.string(), z.string()]).optional(),
    context: z.string().optional(),
  })),
  answers: z.record(z.string()),
})

// Response schema from Claude
const SynthesisResponseSchema = z.object({
  raw_text: z.string(),
  intent: z.enum(['gift', 'purchase', 'research', 'inspiration', 'collection', 'other']),
  connections: z.array(z.string()),
  key_attributes: z.record(z.string()),
  reflection_answers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })),
})

export async function POST(request: NextRequest) {
  try {
    const { client, user, error: authError } = await getAuthenticatedServerClient()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { itemId, collectionId, questions, answers } = parsed.data

    // Fetch item details
    const { data: itemData } = await client
      .from('items')
      .select('title, item_type, brand')
      .eq('id', itemId)
      .single()

    // Fetch collection details
    const { data: collectionData } = await client
      .from('collections')
      .select('name, type')
      .eq('id', collectionId)
      .single()

    if (!itemData || !collectionData) {
      return NextResponse.json(
        { error: 'Item or collection not found' },
        { status: 404 }
      )
    }

    // Cast to proper types
    const item = itemData as ItemSelect
    const collection = collectionData as CollectionSelect

    // Format dialogue for prompt
    const dialogueText = questions
      .filter(q => answers[q.id])
      .map(q => `Q: ${q.text}\nA: ${answers[q.id]}`)
      .join('\n\n')

    // If no answers, return minimal notes
    if (!dialogueText) {
      const minimalNotes: StructuredNotes = {
        raw_text: 'Saved for later',
        intent: 'collection',
        connections: [],
        key_attributes: {},
        reflection_answers: [],
      }
      return NextResponse.json({ structuredNotes: minimalNotes })
    }

    // Build prompt
    const promptTemplate = loadPrompt('synthesize_notes.txt')
    const prompt = replaceVars(promptTemplate, {
      TITLE: item.title || 'Unknown',
      ITEM_TYPE: item.item_type || 'unknown',
      BRAND: item.brand || 'Unknown',
      COLLECTION_NAME: collection.name,
      COLLECTION_TYPE: collection.type || 'default',
      DIALOGUE: dialogueText,
    })

    // Call Claude
    const { data } = await callClaudeJSON<z.infer<typeof SynthesisResponseSchema>>(prompt, {
      max_tokens: 512,
      temperature: 0.3, // More deterministic for synthesis
    })

    // Validate response
    const validatedResponse = SynthesisResponseSchema.safeParse(data)

    if (!validatedResponse.success) {
      console.error('Invalid Claude synthesis response:', validatedResponse.error)
      // Return synthesized notes from raw answers
      return NextResponse.json({
        structuredNotes: createFallbackNotes(questions, answers),
      })
    }

    return NextResponse.json({
      structuredNotes: validatedResponse.data,
    })
  } catch (error) {
    console.error('Error synthesizing notes:', error)

    // Return fallback synthesis
    const body = await request.clone().json()
    return NextResponse.json({
      structuredNotes: createFallbackNotes(body.questions || [], body.answers || {}),
    })
  }
}

/**
 * Create fallback notes when AI synthesis fails
 */
function createFallbackNotes(
  questions: SocraticQuestion[],
  answers: Record<string, string>
): StructuredNotes {
  const reflectionAnswers = questions
    .filter(q => answers[q.id])
    .map(q => ({
      question: q.text,
      answer: answers[q.id],
    }))

  // Try to detect intent from answers
  const allAnswers = Object.values(answers).join(' ').toLowerCase()
  let intent: StructuredNotes['intent'] = 'collection'

  if (allAnswers.includes('gift')) intent = 'gift'
  else if (allAnswers.includes('buy') || allAnswers.includes('purchase')) intent = 'purchase'
  else if (allAnswers.includes('research')) intent = 'research'
  else if (allAnswers.includes('inspir')) intent = 'inspiration'

  // Build raw text from answers
  const rawText = reflectionAnswers
    .map(ra => ra.answer)
    .filter(Boolean)
    .join('. ') || 'Saved for later'

  return {
    raw_text: rawText,
    intent,
    connections: [],
    key_attributes: {},
    reflection_answers: reflectionAnswers,
  }
}
