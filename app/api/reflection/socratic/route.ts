import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { callClaudeJSON, loadPrompt, replaceVars } from '@/lib/ai'
import { getAuthenticatedServerClient } from '@/lib/supabase-server'
import type { SocraticQuestion } from '@/types/meditative-capture'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']
type Collection = Database['public']['Tables']['collections']['Row']

// Type for the nested select query on collection_items with items
type RelatedItemRow = {
  items: {
    id: string
    title: string | null
    item_type: string | null
    brand: string | null
  } | null
}

// Request schema
const RequestSchema = z.object({
  itemId: z.string().uuid(),
  collectionId: z.string().uuid(),
  extractedMetadata: z.object({
    title: z.string().optional(),
    type: z.string().optional(),
    attributes: z.record(z.unknown()).optional(),
  }).optional(),
})

// Response schema from Claude
const SocraticResponseSchema = z.object({
  questions: z.array(z.object({
    id: z.string(),
    text: z.string(),
    type: z.enum(['choice', 'open', 'scale']),
    options: z.array(z.string()).optional(),
    scaleLabels: z.tuple([z.string(), z.string()]).optional(),
    context: z.string().optional(),
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

    const { itemId, collectionId, extractedMetadata } = parsed.data

    // Fetch item details
    const { data: itemData } = await client
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single()

    // Fetch collection details
    const { data: collectionData } = await client
      .from('collections')
      .select('*')
      .eq('id', collectionId)
      .single()

    if (!itemData || !collectionData) {
      return NextResponse.json(
        { error: 'Item or collection not found' },
        { status: 404 }
      )
    }

    // Cast to proper types (Supabase sometimes has trouble inferring)
    const item = itemData as Item
    const collection = collectionData as Collection

    // Fetch related items in the collection
    const { data: relatedItemsData } = await client
      .from('collection_items')
      .select(`
        items (
          id,
          title,
          item_type,
          brand
        )
      `)
      .eq('collection_id', collectionId)
      .limit(5)

    // Cast to expected type
    const relatedItems = relatedItemsData as RelatedItemRow[] | null

    // Parse AI overview for themes if available
    let collectionThemes: string[] = []
    if (collection.ai_overview) {
      try {
        const overview = JSON.parse(collection.ai_overview)
        collectionThemes = overview.themes || []
      } catch {
        // Ignore parse errors
      }
    }

    // Build prompt
    const promptTemplate = loadPrompt('socratic_inquiry.txt')
    const prompt = replaceVars(promptTemplate, {
      TITLE: item.title || 'Unknown',
      ITEM_TYPE: item.item_type || 'unknown',
      BRAND: item.brand || 'Unknown',
      PRICE: item.price ? `${item.currency || '$'}${item.price}` : 'Not specified',
      CATEGORY: item.category || 'Uncategorized',
      ATTRIBUTES: JSON.stringify(item.attributes || {}),
      COLLECTION_NAME: collection.name,
      COLLECTION_TYPE: collection.type || 'default',
      COLLECTION_DESCRIPTION: collection.description || 'No description',
      COLLECTION_THEMES: collectionThemes.join(', ') || 'No themes identified',
      RELATED_ITEMS: relatedItems
        ?.map(ri => {
          const relatedItem = ri.items as { title: string; brand: string } | null
          return relatedItem ? `${relatedItem.title} (${relatedItem.brand || 'Unknown'})` : null
        })
        .filter(Boolean)
        .join(', ') || 'No related items',
      PREVIOUS_ANSWERS: '',
    })

    // Call Claude
    const { data } = await callClaudeJSON<z.infer<typeof SocraticResponseSchema>>(prompt, {
      max_tokens: 1024,
      temperature: 0.8, // Slightly creative for varied questions
    })

    // Validate response
    const validatedResponse = SocraticResponseSchema.safeParse(data)

    if (!validatedResponse.success) {
      console.error('Invalid Claude response:', validatedResponse.error)
      // Return fallback questions
      return NextResponse.json({
        questions: getFallbackQuestions(item, collection),
      })
    }

    // Ensure unique IDs
    const questions: SocraticQuestion[] = validatedResponse.data.questions.map((q, i) => ({
      ...q,
      id: q.id || `q-${i}-${Date.now()}`,
    }))

    return NextResponse.json({ questions })
  } catch (error) {
    console.error('Error generating Socratic questions:', error)

    // Return fallback questions on error
    return NextResponse.json({
      questions: [
        {
          id: 'fallback-1',
          text: 'What drew you to save this?',
          type: 'choice' as const,
          options: ['Gift idea', 'Want to buy', 'Research', 'Inspiration', 'Just saving'],
        },
        {
          id: 'fallback-2',
          text: 'Any context you want to remember?',
          type: 'open' as const,
        },
      ],
    })
  }
}

/**
 * Generate fallback questions when AI is unavailable
 */
function getFallbackQuestions(
  item: { title: string | null; item_type: string | null },
  collection: { name: string; type: string | null }
): SocraticQuestion[] {
  return [
    {
      id: 'fallback-intent',
      text: `Why are you saving this to "${collection.name}"?`,
      type: 'choice',
      options: ['Gift idea', 'Want to buy', 'Research', 'Inspiration', 'Just saving'],
    },
    {
      id: 'fallback-context',
      text: 'Anything you want to remember about this?',
      type: 'open',
    },
  ]
}
