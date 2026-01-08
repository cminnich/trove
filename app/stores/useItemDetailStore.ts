import { create } from 'zustand'

interface ItemDetailStore {
  isOpen: boolean
  itemId: string | null
  collectionId: string | null
  openItemDetail: (itemId: string, collectionId: string) => void
  closeItemDetail: () => void
}

export const useItemDetailStore = create<ItemDetailStore>((set) => ({
  isOpen: false,
  itemId: null,
  collectionId: null,
  openItemDetail: (itemId, collectionId) => set({ isOpen: true, itemId, collectionId }),
  closeItemDetail: () => set({ isOpen: false, itemId: null, collectionId: null }),
}))
