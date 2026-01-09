import { test, expect } from './fixtures/auth'

/**
 * E2E Tests for Multi-Collection Management & Intelligent Note Syncing
 *
 * These tests verify the following features:
 * 1. User-scoped multi-collection management
 * 2. Intelligent note syncing across collections
 * 3. Inbox safety net when removing items from last collection
 * 4. Inconsistent notes detection and sync
 */

test.describe('Multi-Collection Note Syncing', () => {
  // Test data
  const testItemUrl = 'https://example.com/test-product'
  const collectionAName = 'Collection A'
  const collectionBName = 'Collection B'
  const collectionCName = 'Collection C'

  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Navigate to collections page
    await page.goto('/collections')

    // Clean up: Delete any existing test collections
    const existingCollections = await page.locator('[data-testid="collection-card"]').all()
    for (const collection of existingCollections) {
      const name = await collection.locator('[data-testid="collection-name"]').textContent()
      if (
        name === collectionAName ||
        name === collectionBName ||
        name === collectionCName
      ) {
        await collection.locator('[data-testid="collection-menu"]').click()
        await page.locator('[data-testid="delete-collection"]').click()
        await page.locator('[data-testid="confirm-delete"]').click()
      }
    }

    // Create test collections
    for (const collectionName of [collectionAName, collectionBName, collectionCName]) {
      await page.locator('[data-testid="create-collection-button"]').click()
      await page.fill('[data-testid="collection-name-input"]', collectionName)
      await page.click('[data-testid="create-collection-submit"]')
      await page.waitForSelector(`text=${collectionName}`)
    }
  })

  test('should sync notes across collections when sync toggle is enabled', async ({
    authenticatedPage: page,
  }) => {
    // Step 1: Add item to Collection A
    await page.click(`text=${collectionAName}`)
    await page.locator('[data-testid="add-item-button"]').click()
    await page.fill('[data-testid="item-url-input"]', testItemUrl)
    await page.click('[data-testid="add-item-submit"]')

    // Wait for item to appear
    await page.waitForSelector('[data-testid="item-card"]')

    // Step 2: Add item to Collection B via item detail sheet
    await page.click('[data-testid="item-card"]')
    await page.waitForSelector('[data-testid="item-detail-sheet"]')

    // Open collections manager
    await page.click('[data-testid="collections-manager-toggle"]')
    await page.waitForSelector('[data-testid="available-collections"]')

    // Add to Collection B
    await page.click(`[data-testid="add-to-collection-${collectionBName}"]`)
    await page.waitForSelector(`text=In 2 collections`)

    // Step 3: Update note in Collection A with sync enabled
    await page.click('[data-testid="edit-item-button"]')
    await page.fill('[data-testid="notes-textarea"]', 'This is a synced note')

    // Enable sync toggle
    await page.check('[data-testid="sync-notes-checkbox"]')

    // Save changes
    await page.click('[data-testid="save-item-button"]')
    await page.waitForSelector('[data-testid="item-detail-sheet"]:not([data-saving])')

    // Close detail sheet
    await page.click('[data-testid="close-detail-sheet"]')

    // Step 4: Verify note appears in Collection B
    await page.goto('/collections')
    await page.click(`text=${collectionBName}`)
    await page.click('[data-testid="item-card"]')

    // Check that the note is synced
    const noteText = await page.locator('[data-testid="item-notes"]').textContent()
    expect(noteText).toBe('This is a synced note')
  })

  test('should keep notes separate when sync toggle is disabled', async ({
    authenticatedPage: page,
  }) => {
    // Step 1: Add item to Collection A
    await page.click(`text=${collectionAName}`)
    await page.locator('[data-testid="add-item-button"]').click()
    await page.fill('[data-testid="item-url-input"]', testItemUrl)
    await page.click('[data-testid="add-item-submit"]')
    await page.waitForSelector('[data-testid="item-card"]')

    // Step 2: Add item to Collection B
    await page.click('[data-testid="item-card"]')
    await page.click('[data-testid="collections-manager-toggle"]')
    await page.click(`[data-testid="add-to-collection-${collectionBName}"]`)

    // Step 3: Update note in Collection A without sync
    await page.click('[data-testid="edit-item-button"]')
    await page.fill('[data-testid="notes-textarea"]', 'Collection A specific note')

    // Ensure sync is NOT checked
    const syncCheckbox = page.locator('[data-testid="sync-notes-checkbox"]')
    if (await syncCheckbox.isChecked()) {
      await syncCheckbox.uncheck()
    }

    await page.click('[data-testid="save-item-button"]')
    await page.click('[data-testid="close-detail-sheet"]')

    // Step 4: Verify note is different in Collection B
    await page.goto('/collections')
    await page.click(`text=${collectionBName}`)
    await page.click('[data-testid="item-card"]')

    const noteText = await page.locator('[data-testid="item-notes"]').textContent()
    expect(noteText).not.toBe('Collection A specific note')
  })

  test('should show inconsistent notes warning and allow syncing', async ({
    authenticatedPage: page,
  }) => {
    // Step 1: Add item to Collection A and B
    await page.click(`text=${collectionAName}`)
    await page.locator('[data-testid="add-item-button"]').click()
    await page.fill('[data-testid="item-url-input"]', testItemUrl)
    await page.click('[data-testid="add-item-submit"]')
    await page.waitForSelector('[data-testid="item-card"]')

    await page.click('[data-testid="item-card"]')
    await page.click('[data-testid="collections-manager-toggle"]')
    await page.click(`[data-testid="add-to-collection-${collectionBName}"]`)
    await page.click('[data-testid="close-detail-sheet"]')

    // Step 2: Add different notes to each collection
    // Collection A note
    await page.click('[data-testid="item-card"]')
    await page.click('[data-testid="edit-item-button"]')
    await page.fill('[data-testid="notes-textarea"]', 'Note for Collection A')
    await page.click('[data-testid="save-item-button"]')
    await page.click('[data-testid="close-detail-sheet"]')

    // Collection B note
    await page.goto('/collections')
    await page.click(`text=${collectionBName}`)
    await page.click('[data-testid="item-card"]')
    await page.click('[data-testid="edit-item-button"]')
    await page.fill('[data-testid="notes-textarea"]', 'Note for Collection B')
    await page.click('[data-testid="save-item-button"]')

    // Step 3: Verify inconsistent notes warning appears
    await page.waitForSelector('[data-testid="inconsistent-notes-warning"]')
    const warning = page.locator('[data-testid="inconsistent-notes-warning"]')
    await expect(warning).toContainText('Notes are inconsistent')

    // Step 4: Click sync all button
    await page.click('[data-testid="sync-all-notes-button"]')
    await page.waitForSelector('[data-testid="inconsistent-notes-warning"]', { state: 'hidden' })

    // Step 5: Verify notes are now consistent
    await page.click('[data-testid="close-detail-sheet"]')
    await page.goto('/collections')
    await page.click(`text=${collectionAName}`)
    await page.click('[data-testid="item-card"]')

    const noteText = await page.locator('[data-testid="item-notes"]').textContent()
    expect(noteText).toBe('Note for Collection B')
  })

  test('should move item to Inbox when removed from last collection', async ({
    authenticatedPage: page,
  }) => {
    // Step 1: Add item to Collection A
    await page.click(`text=${collectionAName}`)
    await page.locator('[data-testid="add-item-button"]').click()
    await page.fill('[data-testid="item-url-input"]', testItemUrl)
    await page.click('[data-testid="add-item-submit"]')
    await page.waitForSelector('[data-testid="item-card"]')

    // Step 2: Open item detail and remove from Collection A
    await page.click('[data-testid="item-card"]')
    await page.click('[data-testid="collections-manager-toggle"]')
    await page.click('[data-testid="remove-from-collection-button"]')

    // Verify item is gone from Collection A
    await page.click('[data-testid="close-detail-sheet"]')
    const itemsInCollectionA = await page.locator('[data-testid="item-card"]').count()
    expect(itemsInCollectionA).toBe(0)

    // Step 3: Verify item appears in Inbox
    await page.goto('/collections')

    // Check if Inbox was created
    const inboxExists = await page.locator('text=Inbox').count()
    expect(inboxExists).toBeGreaterThan(0)

    // Navigate to Inbox and verify item is there
    await page.click('text=Inbox')
    const itemsInInbox = await page.locator('[data-testid="item-card"]').count()
    expect(itemsInInbox).toBe(1)
  })

  test('should manage multiple collections for a single item', async ({
    authenticatedPage: page,
  }) => {
    // Step 1: Add item to Collection A
    await page.click(`text=${collectionAName}`)
    await page.locator('[data-testid="add-item-button"]').click()
    await page.fill('[data-testid="item-url-input"]', testItemUrl)
    await page.click('[data-testid="add-item-submit"]')
    await page.waitForSelector('[data-testid="item-card"]')

    // Step 2: Open collections manager
    await page.click('[data-testid="item-card"]')
    await page.click('[data-testid="collections-manager-toggle"]')

    // Step 3: Add to Collection B and C
    await page.click(`[data-testid="add-to-collection-${collectionBName}"]`)
    await page.waitForSelector(`text=In 2 collections`)

    await page.click(`[data-testid="add-to-collection-${collectionCName}"]`)
    await page.waitForSelector(`text=In 3 collections`)

    // Step 4: Verify all collections are listed
    const collectionsList = page.locator('[data-testid="current-collections"]')
    await expect(collectionsList).toContainText(collectionAName)
    await expect(collectionsList).toContainText(collectionBName)
    await expect(collectionsList).toContainText(collectionCName)

    // Step 5: Remove from Collection B
    await page.click(`[data-testid="remove-from-${collectionBName}"]`)
    await page.waitForSelector(`text=In 2 collections`)

    // Verify Collection B is no longer listed
    await expect(collectionsList).not.toContainText(collectionBName)
  })
})
