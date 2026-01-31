# Open Trove Design System: Terminal Noir

## Core Philosophy

Open Trove is a **Social Collections Platform** for the AI era. The design system, Terminal Noir, creates a distinctive, focused environment that honors the heritage of terminal interfaces while feeling modern and intentional.

### Design Principles
- **Monospace-first**: JetBrains Mono throughout creates consistency and technical feel
- **Dark and focused**: Void backgrounds eliminate distractions
- **Green accent**: Strategic use of "open green" for calls to action
- **Terminal aesthetic**: Uppercase headers, hard shadows, sharp borders
- **Information density**: Prioritize metadata visibility for both humans and AI

---

## Visual Identity

### Logo: "OPEN TROVE"
Typographic logo in monospace uppercase with open green accent.

**Brand Treatment**:
```tsx
<span className="text-open-green font-mono font-bold tracking-widest uppercase">
  OPEN TROVE
</span>
```

**Visual Language**:
- Always uppercase, wide tracking
- JetBrains Mono font
- Open green (#10b981) color
- No icon or mark - pure typography
- Terminal-inspired simplicity

### Color Palette

Terminal Noir uses a minimal, high-contrast palette:

```css
/* Backgrounds */
--color-void: #050505;        /* Primary background - deep black */
--color-slate-deep: #0a0a0a;  /* Secondary background - slightly lighter */

/* Borders & Dividers */
--color-slate-800: #1e293b;   /* Borders, dividers, inactive elements */

/* Accent */
--color-open-green: #10b981;  /* Primary accent, CTAs, active states, links */

/* Text */
--color-slate-300: #cbd5e1;   /* Primary text */
--color-slate-500: #64748b;   /* Secondary text, labels */
--color-slate-400: #94a3b8;   /* Tertiary text, placeholders */
```

**Status**: Fully implemented in `app/globals.css` and used throughout the application.

### Typography

Terminal Noir uses **JetBrains Mono exclusively** for a consistent, terminal-inspired feel:

- **All text**: JetBrains Mono via `font-mono` class
- **Headers**: Uppercase with wide tracking (`tracking-widest`)
  - Example: `className="font-mono text-xs uppercase tracking-widest"`
- **Body text**: Slate-300 for readability on dark backgrounds
- **Labels**: Slate-500, smaller sizes (text-xs, text-sm)
- **Size scale**:
  - Headers: text-xs to text-sm (uppercase makes them feel larger)
  - Body: text-sm to text-base
  - Metadata: text-xs

**Implementation**:
```tsx
// Header
<h2 className="font-mono text-xs uppercase tracking-widest text-slate-500">
  COLLECTION SETTINGS
</h2>

// Body text
<p className="font-mono text-sm text-slate-300">
  Your collection description
</p>

// Logo
<span className="text-open-green font-mono font-bold tracking-widest uppercase">
  OPEN TROVE
</span>
```

---

## Terminal Noir Component Patterns

### Containers
Standard container pattern with Terminal Noir styling:
```tsx
<div className="bg-void border border-slate-800 rounded-md shadow-hard">
  {/* content */}
</div>
```

### Terminal Headers
Section headers use terminal-style typography:
```tsx
<div className="font-mono text-xs uppercase tracking-widest text-slate-500 border-b border-slate-800 px-4 py-2">
  COLLECTION SETTINGS
</div>
```

### Primary Buttons
Green accent for primary actions:
```tsx
<button className="bg-open-green hover:bg-emerald-400 text-void font-mono font-bold px-4 py-2 rounded-md">
  SAVE CHANGES
</button>
```

### Secondary Buttons
Border-based for secondary actions:
```tsx
<button className="border border-slate-800 hover:border-slate-600 text-slate-300 font-mono px-4 py-2 rounded-md">
  CANCEL
</button>
```

### Navigation
- **Active**: `bg-slate-800 text-open-green`
- **Inactive**: `text-slate-400 hover:text-slate-200`

### Collection Views
- **Grid/List toggle**: Implemented with localStorage persistence
- **Grid**: 2×2 thumbnail previews per collection card
- **List**: Dense rows with metadata
- **Drag handles**: Edit mode with 500ms long-press activation

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
