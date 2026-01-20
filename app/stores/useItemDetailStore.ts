import { create } from 'zustand'

interface ItemDetailStore {
  isOpen: boolean
  itemId: string | null
  collectionId: string | null
  // Navigation state
  itemIndex: number
  allItemIds: string[]
  // Filter state
  activeFilter: string | null // group_key for filtering
  filteredItemIds: string[] | null // Item IDs when filtered, null means no filter
  // Actions
  openItemDetail: (itemId: string, collectionId: string, index?: number, allItemIds?: string[]) => void
  closeItemDetail: () => void
  navigateToIndex: (index: number) => void
  navigateNext: () => void
  navigatePrev: () => void
  setFilter: (groupKey: string | null, itemIds: string[] | null) => void
  clearFilter: () => void
}

export const useItemDetailStore = create<ItemDetailStore>((set, get) => ({
  isOpen: false,
  itemId: null,
  collectionId: null,
  itemIndex: 0,
  allItemIds: [],
  activeFilter: null,
  filteredItemIds: null,

  openItemDetail: (itemId, collectionId, index = 0, allItemIds = []) =>
    set({
      isOpen: true,
      itemId,
      collectionId,
      itemIndex: index,
      allItemIds,
      activeFilter: null,
      filteredItemIds: null,
    }),

  closeItemDetail: () =>
    set({
      isOpen: false,
      itemId: null,
      collectionId: null,
      itemIndex: 0,
      allItemIds: [],
      activeFilter: null,
      filteredItemIds: null,
    }),

  navigateToIndex: (index) => {
    const state = get()
    const ids = state.filteredItemIds ?? state.allItemIds
    if (index >= 0 && index < ids.length) {
      set({
        itemIndex: index,
        itemId: ids[index],
      })
    }
  },

  navigateNext: () => {
    const state = get()
    const ids = state.filteredItemIds ?? state.allItemIds
    const nextIndex = state.itemIndex + 1
    if (nextIndex < ids.length) {
      set({
        itemIndex: nextIndex,
        itemId: ids[nextIndex],
      })
    }
  },

  navigatePrev: () => {
    const state = get()
    const ids = state.filteredItemIds ?? state.allItemIds
    const prevIndex = state.itemIndex - 1
    if (prevIndex >= 0) {
      set({
        itemIndex: prevIndex,
        itemId: ids[prevIndex],
      })
    }
  },

  setFilter: (groupKey, itemIds) => {
    const state = get()
    if (!itemIds || itemIds.length === 0) {
      // Clear filter if no matching items
      set({
        activeFilter: null,
        filteredItemIds: null,
      })
      return
    }
    // Find current item in filtered list to set correct index
    const currentItemId = state.itemId
    let newIndex = 0
    if (currentItemId) {
      const foundIndex = itemIds.indexOf(currentItemId)
      if (foundIndex >= 0) {
        newIndex = foundIndex
      } else {
        // Current item not in filtered list, jump to first
        newIndex = 0
      }
    }
    set({
      activeFilter: groupKey,
      filteredItemIds: itemIds,
      itemIndex: newIndex,
      itemId: itemIds[newIndex],
    })
  },

  clearFilter: () => {
    const state = get()
    // Find current item in full list to restore index
    const currentItemId = state.itemId
    let newIndex = 0
    if (currentItemId) {
      const foundIndex = state.allItemIds.indexOf(currentItemId)
      if (foundIndex >= 0) {
        newIndex = foundIndex
      }
    }
    set({
      activeFilter: null,
      filteredItemIds: null,
      itemIndex: newIndex,
    })
  },
}))
