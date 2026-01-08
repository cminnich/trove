# Trove Logo: "T + Heart"

## Design Concept

The logo layers two powerful symbols: a **T** (for Trove) representing factual, structured data, and a **heart** representing emotional, personal context. This captures the duality of the system:
- **What you saved** (objective facts: title, price, brand)
- **Why you saved it** (subjective context: notes, feelings, intent)

### Visual Elements

```
       (35,15) (65,15)
          ╲ ╱ ╲ ╱       ← Heart top curves
   (10,50) (20,30)─(50,30)─(80,30) (90,50)
             ╲       │       ╱
              ╲      │      ╱
               ╲     │     ╱
                ╲    │    ╱
                 ╲   │   ╱
                  ╲  │  ╱
                   (50,85)  ← Heart & T converge
```

#### Two-Layer Structure

**Heart Layer** (35-40% opacity):
- Subtle indigo lines forming a heart shape behind the T
- 4 small nodes: (10,50), (90,50), (35,15), (65,15)
- Connects to T nodes at (20,30), (80,30), (50,30)
- Converges at bottom point (50,85)
- **Meaning**: The emotional/personal reasons behind saving items
  - "I want to buy this for my partner"
  - "This reminds me of a trip"
  - "Need to research this further"

**Primary T Structure** (4 main nodes + center accent):
- **Top horizontal bar**: Three nodes at y=30
  - Left (20,30), Center (50,30), Right (80,30)
  - Center node is slightly larger (r=7 vs r=6)
  - Represents objective facts extracted by AI

- **Vertical stem**: Center to bottom (50,85)
  - Persistent item identity
  - Can exist in multiple collections

- **Center accent**: Small indigo dot at (50,30)
  - Visual anchor point where T and heart intersect
  - Symbolizes the fusion of fact and feeling

## Color Theory

### Light Mode (`logo.svg`)
- **Primary T**: White fill (`#FFFFFF`), 5px stroke, 3px node borders
- **Heart layer**: 35% opacity, 1.2px stroke
- **Rationale**: Soft, barely-there heart creates emotional undercurrent without overwhelming the factual T

### Dark Mode (`logo-dark.svg`)
- **Primary T**: Carbon fill (`#1A1A1A`), 5px stroke, 3px node borders
- **Heart layer**: 40% opacity, 1px stroke (slightly more visible than light mode)
- **Rationale**: Heart is more present on dark background, suggesting the "human context" behind the data workbench

## Design Philosophy Alignment

This logo embodies the three core principles of Trove:

1. **The 3-Second Rule**: Clean T is instantly recognizable; heart is discovered on closer inspection
2. **Context over Content**: The heart represents *why* you saved something, not just *what* you saved
3. **AI-Native Density**: T structure signals data/facts, heart signals human intent - both are essential for AI context

## Usage Guidelines

### Sizes
- **Full display**: 120x120px (default)
- **Navigation**: 48x48px (LogoIcon)
- **Favicon**: 32x32px, 16x16px (exported from base SVG)

### Spacing
- Minimum clear space: 10px on all sides
- Don't stretch or distort the aspect ratio (always square)

### What NOT to do
- Don't add gradients or effects
- Don't rotate or skew
- Don't change the node structure or positions
- Don't use colors outside the design system palette

## Files

- `/public/logo.svg` - Light mode static asset
- `/public/logo-dark.svg` - Dark mode static asset
- `/app/components/Logo.tsx` - React component with variant support

---

*Design v1 - 2026-01-07*
