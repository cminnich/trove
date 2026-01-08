# Trove Design System

## Core Philosophy

Trove is a **Knowledge Workbench** for AI context, not a visual bookmarking tool. Every design decision prioritizes utility and information density over aesthetic flourish.

### The 3-Second Rule
- **Capture must be invisible**: User provides *why* (notes), AI extracts *what* (metadata)
- **Context over content**: The value is in relationships between items and collections
- **AI-native density**: Prioritize metadata visibility for both humans and LLMs

---

## Visual Identity

### Logo: "T + Heart"
A layered design combining a bold **T** (for Trove) with a subtle **heart** in the background.

**Design Features**:
- **Primary T structure**: 4 main nodes representing objective, factual data
  - What you saved: title, price, brand, URL
  - Extracted by AI from web pages
- **Heart layer**: Subtle background (35-40% opacity) representing emotional/personal context
  - Why you saved it: notes, intentions, memories
  - Added by the user
- **Visual metaphor**: Facts + Feelings = Complete AI Context
- **Convergence point**: Heart and T meet at (50,85), symbolizing the fusion of objective and subjective data

**Implementation**:
- Static SVGs: `/public/logo.svg` (light mode), `/public/logo-dark.svg` (dark mode)
- React component: `<Logo />` in `app/components/Logo.tsx`
- Variants: `variant="auto"` (default, responds to color scheme), `"light"`, `"dark"`
- Sizes: `size={120}` (default), customizable via prop

**Usage**:
```tsx
import { Logo, LogoIcon } from '@/app/components/Logo'

<Logo size={120} variant="auto" />  // Full logo with ghost network
<LogoIcon size={48} />               // Icon-only for mobile/favicon
```

### Color Palette

```css
/* Primary - Already added to app/globals.css */
--color-carbon: #1A1A1A;          /* Dark background (inverts to white in dark mode) */
--color-white: #FFFFFF;            /* Light background */
--color-indigo-accent: #6366F1;    /* Primary actions, links */
--color-indigo-accent-dark: #4F46E5; /* Hover states */
--color-amber-status: #F59E0B;     /* Low confidence warnings */

/* Tailwind-native (use via utility classes) */
--gray-50: #F9FAFB;        /* Subtle backgrounds */
--gray-800: #1F2937;       /* Card backgrounds (dark) */
--gray-200: #E5E7EB;       /* Borders (light) */
--amber-50: #FFFBEB;       /* Low confidence background */
--amber-200: #FDE68A;      /* Low confidence border */
--amber-800: #92400E;      /* Low confidence text */

/* Data/Monospace */
--mono-font: 'JetBrains Mono', 'SF Mono', 'Courier New', monospace;
```

**Status**: Core colors implemented in `app/globals.css`. Tailwind extension needed for gray/amber utilities.

### Typography

- **Interface**: `Inter` (Variable font) - High legibility, mobile-optimized
  - Body: 16px (1rem)
  - Small: 14px (0.875rem)
  - Tiny: 12px (0.75rem) for metadata
- **Data/Code**: `JetBrains Mono` for prices, IDs, "Copy for AI" blocks
  - Use tabular numerals for price alignment

**Next.js Integration**: Use `next/font/google` for Inter, load JetBrains Mono as fallback.

---

## UI Patterns & Information Density

### Default View: Dense List
Items default to **compact rows** with maximum metadata visibility:
- **Row height**: 80-100px
- **Visible metadata**: Brand, Price, Category, Tags, Item Type
- **Thumbnail**: 64x64px, object-fit: contain
- **Tap target**: Minimum 44x44px for mobile

### Hybrid View Toggle
Provide a Grid/List toggle for visual-first collections (clothing, furniture):
- **Grid mode**: 2 columns on mobile, 3-4 on tablet/desktop
- **Card size**: Square aspect ratio, centered image
- **Metadata overlay**: Price + Brand on hover/long-press

### Surface Style
- **Borders**: 1px solid, gray-200 (light) / gray-800 (dark)
- **No heavy shadows**: Use subtle elevation only for modals/dropdowns
- **Border radius**: 8px for cards, 6px for buttons, 4px for badges

---

## Mobile-First Principles

### Touch Targets
- **Minimum size**: 44x44px (iOS HIG standard)
- **Spacing**: 8px minimum between interactive elements
- **Swipe gestures**: Left swipe to remove from collection, right swipe for quick actions

### Responsive Breakpoints (Tailwind)
```
sm:  640px   # Large phones (landscape)
md:  768px   # Tablets
lg:  1024px  # Desktop
xl:  1280px  # Large desktop
```

### Navigation
- **Bottom nav bar** (mobile): Collections, Add, Settings
- **Top bar** (desktop): Horizontal nav with search
- **iOS Safe Area**: Use `env(safe-area-inset-*)` for notch/home indicator

---

## AI-Specific Features

### Confidence Badging
Display visual indicators when `confidence_score < 0.7`:
- **Badge**: Amber "Review" chip in top-right of item card
- **Color**: Use `amber-50` background, `amber-800` text
- **Icon**: ⚠️ or "!" icon
- **Tooltip**: "Low confidence extraction. Please verify details."

**Already implemented** in `/app/add/page.tsx:198-203` - extend to collection views.

### Context Export ("Copy for AI")
Every collection view must have a "Copy for AI" button that generates LLM-optimized output:

**Format**: Markdown + JSON hybrid
```markdown
# Collection: Winter Hiking Gear

## Items (3)

### 1. Patagonia Down Sweater
- **Brand**: Patagonia
- **Price**: $229 USD
- **Type**: Clothing
- **URL**: https://...
- **Notes**: Need size Medium, looking for color "Navy"

```json
{"id": "abc123", "price": 229, "currency": "USD", ...}
```
```

**Implementation**: Create `/api/collections/[id]/context` endpoint that returns this format.

### Staleness Tracking
Visually indicate items where `last_viewed_at > 30 days`:
- **Visual treatment**: Reduce opacity to 70%, add "stale" badge
- **Action**: Prompt user to refresh price or review item
- **Future**: Automatic background price refresh job

---

## Phase 4 Implementation Checklist

### Collections View (`/collections` and `/collections/[id]`)
- [ ] Implement Dense List as default view
- [ ] Add Grid/List toggle with state persistence (localStorage)
- [ ] Show low confidence badge for items where `confidence_score < 0.7`
- [ ] Add "Recent Collections" horizontal scroll on `/add` page
- [ ] Implement touch-friendly swipe gestures for item management
- [ ] Add empty states with helpful prompts ("Start by adding an item")

### Playwright Validation (Required for Phase 4 Completion)
- [ ] **[Playwright]** Navigate to /collections and verify page loads
- [ ] **[Playwright]** Test Dense List rendering with multiple items
- [ ] **[Playwright]** Test Grid/List toggle switch and persistence
- [ ] **[Playwright]** Verify low confidence badge displays correctly
- [ ] **[Playwright]** Test horizontal scroll for Recent Collections
- [ ] **[Playwright]** Verify empty state displays when no items exist
- [ ] **[Playwright]** Test responsive layout at 375px (mobile), 768px (tablet), 1024px (desktop)
- [ ] **[Playwright]** Verify touch target sizes (minimum 44x44px)

### CSS Updates (`app/globals.css`)
- [ ] Add design system color variables
- [ ] Import Inter from `next/font/google`
- [ ] Add utility classes for data/monospace font
- [ ] Configure Tailwind for custom colors (extend theme in `tailwind.config.ts`)

### Component Library (Future)
Consider creating reusable components:
- `<ItemCard variant="dense" | "grid" />`
- `<ConfidenceBadge score={0.65} />`
- `<PriceDisplay value={229} currency="USD" />`
- `<CollectionChip name="Winter Gear" count={12} />`

---

## Testing Standards

### Playwright as Default

**All UI features must be validated with Playwright before marking as complete.**

**Standard Testing Flow:**
1. Implement feature
2. Start dev server (`npm run dev`)
3. Use Playwright tools via Claude Code to:
   - Navigate to the page
   - Take snapshot to verify rendering
   - Test interactions (clicks, form fills, swipes)
   - Verify responsive behavior
   - Test error states
4. Document results or fix issues
5. Mark feature as complete only after Playwright validation

**Common Test Scenarios:**
- **Page loads**: Navigate to URL → snapshot → verify expected elements
- **Form submission**: Fill form → click submit → verify API response → verify success state
- **Responsive**: Resize to mobile (375x667) → verify layout adjusts correctly
- **Error handling**: Trigger error condition → verify error message displays
- **State persistence**: Toggle setting → refresh page → verify setting persisted

**Integration with TODO.md:**
- Every implementation task should have corresponding `[Playwright]` test checkboxes
- Tests are not "nice to have" - they are required completion criteria
- Format: `- [ ] **[Playwright]** <description of test>`

**Example:**
```
## Phase X: Feature Implementation
- [ ] Build feature component
- [ ] Wire up API endpoint
- [ ] **[Playwright]** Navigate to /feature and verify rendering
- [ ] **[Playwright]** Test form submission and success state
- [ ] **[Playwright]** Verify mobile responsive layout (375px)
```

---

## Design Constraints

### What NOT to do
- **No heavy animations**: Subtle transitions only (200-300ms)
- **No "delight" for the sake of it**: Every interaction should have utility
- **No hiding metadata**: If it's useful for AI, show it to humans
- **No premature abstraction**: Build components when you need them 3+ times

### Performance Budget
- **First Contentful Paint**: < 1.5s on 4G
- **Largest Contentful Paint**: < 2.5s on 4G
- **Time to Interactive**: < 3.5s on 4G
- **Image loading**: Lazy load below the fold, use Next.js Image component

---

## Future Considerations

### Logo Design
When ready to implement the "Graph T" logo:
1. Create SVG with nodes and connecting lines
2. Ensure it works in monochrome (dark mode)
3. Make it scalable (16px to 128px)
4. Consider animated version for loading states

### Advanced Features (Post-MVP)
- Dark/light/auto theme toggle (currently auto-only)
- Customizable density settings per user
- Collection color coding
- Visual relationship graph between items
- Bulk editing and multi-select

---

## References

- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) - Touch targets, safe areas
- [Tailwind CSS Documentation](https://tailwindcss.com/docs) - Utility classes, responsive design
- [Inter Variable Font](https://rsms.me/inter/) - Typography reference
- [Next.js Image Optimization](https://nextjs.org/docs/pages/building-your-application/optimizing/images) - Performance

---

## Testing Resources

- **Playwright MCP Server**: Available in Claude Code, no setup needed
- **Testing Philosophy**: See README.md § Testing Philosophy
- **Integration Tests**: See tests/README.md for Vitest integration tests

---

*Last updated: 2026-01-07 (Added Playwright testing standards)*
