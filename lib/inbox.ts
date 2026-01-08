import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Collection = Database['public']['Tables']['collections']['Row']

/**
 * Ensures an "Inbox" collection exists for the current user.
 * Creates it if it doesn't exist.
 *
 * @returns The ID of the Inbox collection
 */
export async function ensureInboxCollection(
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  try {
    // Get current user - suppress "session missing" errors
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      // Silently return null if no session (expected when not authenticated)
      if (authError.message?.includes('session') || authError.message?.includes('Auth')) {
        return null
      }
      console.error('Error getting current user:', authError)
      return null
    }

    if (!user) {
      return null
    }

    // Check if Inbox already exists for this user
    const { data: existing, error: fetchError } = await supabase
      .from('collections')
      .select('*')
      .eq('name', 'Inbox')
      .eq('type', 'inbox')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (fetchError) {
      console.error('Error checking for Inbox collection:', fetchError)
      return null
    }

    // If exists, return its ID
    if (existing) {
      return (existing as Collection).id
    }

    // Create Inbox collection for this user
    const insertData: Database['public']['Tables']['collections']['Insert'] = {
      name: 'Inbox',
      type: 'inbox',
      description: 'Default collection for new items',
      owner_id: user.id,
      visibility: 'private' // Inbox is private by default
    }

    const { data: newInbox, error: createError } = await supabase
      .from('collections')
      .insert(insertData as any)
      .select('*')
      .single()

    if (createError || !newInbox) {
      console.error('Error creating Inbox collection:', createError)
      return null
    }

    return (newInbox as Collection).id
  } catch (error) {
    console.error('Error in ensureInboxCollection:', error)
    return null
  }
}

/**
 * Gets the Inbox collection ID for the current user, or null if it doesn't exist.
 * Does not create it if missing (use ensureInboxCollection for that).
 */
export async function getInboxCollectionId(
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  try {
    // Get current user - suppress "session missing" errors
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      // Silently return null if no session (expected when not authenticated)
      if (authError.message?.includes('session') || authError.message?.includes('Auth')) {
        return null
      }
      return null
    }

    if (!user) {
      return null
    }

    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('name', 'Inbox')
      .eq('type', 'inbox')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (error || !data) {
      return null
    }

    return (data as Collection).id
  } catch (error) {
    console.error('Error in getInboxCollectionId:', error)
    return null
  }
}
