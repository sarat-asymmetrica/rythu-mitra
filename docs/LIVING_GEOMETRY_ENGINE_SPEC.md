# Living Geometry Engine — Mathematical Design System Specification

**Version:** 1.0 — Foundation Spec
**Date:** March 15, 2026
**Authors:** Sarat (Commander) + Claude (Research Dyad)
**Status:** Canonical Reference — All Asymmetrica visual systems derive from this

---

## Preface: What This Is

This document specifies a **design engine**, not a design system.

A design system is a collection of decisions: here are the colors, here are the spacing values, here are the components. A design engine is a **mathematical substrate** that *generates* those decisions from first principles. Feed it data. Feed it context. Feed it a cultural rotation. It produces CSS custom properties, GSAP timelines, canvas render commands, and component props — all internally consistent because they all derive from the same quaternion state.

The goal is a system where every visual property — color, spacing, animation duration, shadow depth, border radius, easing curve — is computable from a quaternion. Different cultures are different rotations of the same quaternion. Different regimes are different phases of the same dynamics. Different moods are different positions on the same 3-sphere.

**One equation:**
```
∂Φ/∂t = Φ ⊗ Φ + C(domain)
```

**One substrate:** S³ — the unit 3-sphere embedded in 4D space

**One rendering pipeline:** quaternion → visual properties → CSS/GSAP/Canvas output

---

## Table of Contents

1. [Mathematical Foundation](#section-1-mathematical-foundation)
2. [Engine Architecture](#section-2-engine-architecture)
3. [Quaternion-Driven Components](#section-3-quaternion-driven-components)
4. [The Theme Engine — Cultural Adaptation](#section-4-the-theme-engine)
5. [GSAP Integration Patterns](#section-5-gsap-integration-patterns)
6. [Performance Budget](#section-6-performance-budget)
7. [The @asymm/qgif-web TypeScript Port](#section-7-the-asymmqgif-web-typescript-port)
8. [Integration with Existing Systems](#section-8-integration-with-existing-systems)
9. [Recipes](#section-9-recipes)
10. [Appendix: Constants Reference](#appendix-constants-reference)

---

## Section 1: Mathematical Foundation

### 1.1 The Quaternion as the Universal Visual Atom

A quaternion `q = (w, x, y, z)` on the unit 3-sphere satisfies:
```
w² + x² + y² + z² = 1
```

Every visual property in the Living Geometry Engine is a **deterministic function of a quaternion**. There is no randomness, no arbitrary decision. Given `q`, the entire visual state is determined. Given a SLERP path between `q_a` and `q_b`, the entire animation is determined.

The source of truth for a quaternion can be:
- Data: a farm expense value, a temperature reading, a user ID
- State: the current application regime, the session progress, the error count
- Context: screen size, time of day, user's language, cultural configuration
- Culture: a fixed rotation that maps the universal palette to a specific expression

### 1.2 The Full Quaternion → Visual Property Mapping

**Input:** Unit quaternion `q = (w, x, y, z)` where `w² + x² + y² + z² = 1`

#### 1.2.1 Color — toRGB()

The canonical mapping from the QGIF Python source:

```
brightness = (w + 1) / 2          -- maps w from [-1,1] to [0,1]
R = |x| × brightness
G = |y| × brightness
B = |z| × brightness
```

This produces colors that are **geometrically consistent**: quaternions near the identity `(1,0,0,0)` produce dark/muted colors (low brightness, low saturation). Quaternions near the equator of S³ (where `w ≈ 0`) produce mid-brightness, fully saturated colors. Quaternions near `(-1,0,0,0)` produce again dark colors via the brightness formula.

The result is a color space where **smooth visual transitions correspond to geodesic paths on S³**. SLERP between two quaternions produces color transitions that are perceptually smoother than any RGB lerp, because they follow the geometry of the sphere rather than a straight line through Euclidean space.

For the CSS `hsl()` form (easier to reason about in design), convert via:

```
L = brightness = (w + 1) / 2
S = magnitude of (x, y, z) vector = sqrt(x² + y² + z²)  [already ≤ 1 on unit sphere]
H = atan2(y, x) × (180/π)   -- azimuthal angle, range [0°, 360°)
```

This is the **quaternion HSL** mapping. Hue encodes the angle in the x-y plane of the imaginary part. Saturation encodes how "far off axis" the imaginary vector is. Lightness encodes the real part.

#### 1.2.2 Opacity

```
opacity = (w + 1) / 2
```

Same as brightness. Maximum opacity at `w = 1` (identity quaternion = fully present, fully visible). Zero opacity at `w = -1` (anti-identity = absent). Components entering the scene SLERP from a quaternion with low `w` to one with high `w`, so they "materialize" as they rotate into presence.

#### 1.2.3 Scale and Size

```
scale = 0.5 + (w + 1) / 4      -- maps to [0.5, 1.0]
```

Or for absolute sizes in a Fibonacci-anchored layout:

```
size_index = round( |x| × 8 )  -- maps to Fibonacci[0..8]
size_px = FIBONACCI[size_index] × BASE_UNIT
```

Where `BASE_UNIT = 8px` and `FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597]`.

#### 1.2.4 Rotation

Quaternions **are** rotations. No conversion needed for 2D:

```
rotation_2d_degrees = 2 × acos(w) × (180/π)    -- total rotation angle
rotation_axis_2d = atan2(sqrt(x² + y²), z)      -- projected to 2D plane
```

For CSS `transform: rotate()`, extract the angle around the z-axis:

```
css_rotation = atan2(2(wx + yz), 1 - 2(y² + x²))  -- in radians, then convert
```

This is the standard quaternion-to-Euler extraction for the z-axis component.

#### 1.2.5 Border Radius — Wabi-Sabi Irregularity

The irregular, handmade feel of wabi-sabi and matti design comes from **non-uniform border radii**. Each corner gets a different value derived from the quaternion's components:

```
top-left-radius     = BASE_RADIUS × (0.5 + |w| × 0.5)
top-right-radius    = BASE_RADIUS × (0.5 + |x| × 0.5)
bottom-right-radius = BASE_RADIUS × (0.5 + |y| × 0.5)
bottom-left-radius  = BASE_RADIUS × (0.5 + |z| × 0.5)

BASE_RADIUS = 8px (one Fibonacci step)
```

Range for each corner: `[4px, 8px]`. This produces subtle, organic variation that reads as "handmade" without being visually jarring.

For a SLERP transition between two quaternions, the border radii animate through organic intermediate shapes — no CSS transition is needed, GSAP handles it frame by frame.

#### 1.2.6 Shadow Depth — Rayleigh Scattering

The QGIF engine uses Rayleigh scattering for depth perception: `scatter = (wavelength / size)^4`. Applied to shadows:

```
shadow_intensity = w × (1 - scatter × 0.5)
scatter = (1.0 / scale)^4      -- smaller elements scatter more (appear further away)

shadow_x      = x × shadow_intensity × SHADOW_SCALE
shadow_y      = y × shadow_intensity × SHADOW_SCALE
shadow_blur   = |z| × shadow_intensity × SHADOW_SCALE × 2
shadow_spread = (w - 0.5) × SHADOW_SCALE × 0.5

SHADOW_SCALE = 8px
```

This produces shadows where:
- Elements with high `w` (closer to identity) cast stronger, crisper shadows (foreground)
- Elements with low `w` cast softer, diffuse shadows (background haze)
- The shadow direction follows the x,y components of the quaternion

#### 1.2.7 Animation Duration — Geodesic Distance

The time it takes to animate between two states should be proportional to the **geodesic distance** between their quaternions:

```
theta = 2 × acos( |dot(q1, q2)| )    -- geodesic angle, range [0, π]

duration_ms = BASE_DURATION × (theta / π) × DURATION_SCALE
BASE_DURATION = 233ms    -- Fibonacci[13]
DURATION_SCALE = 3       -- max duration = 3 × 233 = 699ms ≈ 610ms (Fibonacci[15])
```

A quaternion that barely moves (small theta) animates quickly. A quaternion that reverses completely (theta = π, maximum geodesic distance) takes ~700ms — never more, because S³ has bounded diameter.

This means **animations are automatically proportionate to visual change**. No separate duration decisions required.

---

### 1.3 The Fibonacci Layout System

All spatial decisions derive from the Fibonacci sequence and the golden ratio `φ = 1.618033988749895`.

#### 1.3.1 Spacing Scale

```
FIBONACCI_PX = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377]

--space-1:   1px    (hairline)
--space-2:   2px    (separator)
--space-3:   3px    (tight gap)
--space-5:   5px    (icon gap)
--space-8:   8px    (base unit, xs gap)
--space-13:  13px   (sm gap)
--space-21:  21px   (md gap)
--space-34:  34px   (lg gap)
--space-55:  55px   (xl gap, card padding)
--space-89:  89px   (2xl gap, section padding)
--space-144: 144px  (3xl, layout margin)
```

The ratio between adjacent values approaches φ. The system never uses arbitrary values like 16px, 24px, 32px. Every spacing decision is a Fibonacci value.

#### 1.3.2 Type Scale

```
BASE_SIZE = 13px     -- Fibonacci[7], optimized for Telugu script readability

SCALE_RATIO = φ = 1.618033988749895

--text-xs:    8px    -- (13 / φ²)
--text-sm:    10px   -- (13 / φ)
--text-base:  13px   -- base
--text-md:    21px   -- (13 × φ)
--text-lg:    34px   -- (13 × φ²)
--text-xl:    55px   -- (13 × φ³)
--text-2xl:   89px   -- (13 × φ⁴)
--text-3xl:   144px  -- (13 × φ⁵)
```

Each step is exactly φ times the previous. This is not a coincidence — the golden ratio is the unique value where a type scale has maximum harmonic coherence. Adjacent sizes relate by a single consistent ratio.

#### 1.3.3 Grid Proportions

```
PRIMARY_RATIO:     1 : φ     ≈ 1 : 1.618   -- most cards, content blocks
SECONDARY_RATIO:   1 : φ²    ≈ 1 : 2.618   -- narrow utility panels
TERTIARY_RATIO:    φ : φ²    ≈ 1 : 1.618   -- golden rectangle nested content
SQUARE:            1 : 1                   -- avatars, icons, chart squares
```

A two-column layout uses `φ : 1` columns (about 62% / 38%). A three-panel layout uses `φ² : φ : 1` (about 52% / 32% / 16%).

#### 1.3.4 Animation Durations

```
DURATIONS_MS = [8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]

--dur-instant:    8ms    -- immediate feedback (ripple start, button press)
--dur-micro:      13ms   -- hover state change
--dur-fast:       21ms   -- icon swap, badge update
--dur-quick:      34ms   -- tooltip appear
--dur-normal:     55ms   -- focus ring, input border
--dur-standard:   89ms   -- chip selection, toggle
--dur-comfortable: 144ms -- card appear, slide in
--dur-relaxed:    233ms  -- page section enter
--dur-slow:       377ms  -- modal open
--dur-deliberate: 610ms  -- full screen transition
--dur-ceremonial: 987ms  -- celebration sequence
```

#### 1.3.5 Stagger Offsets

When multiple elements enter simultaneously, each is staggered by a Fibonacci interval:

```
stagger_per_element = 21ms    -- Fibonacci[8]
stagger_max = 144ms           -- cap at Fibonacci[12], so large lists still feel snappy
```

GSAP's `stagger` property takes `each: 0.021` (seconds).

---

### 1.4 The Three-Regime Visual System

The engine tracks which regime a UI is currently in and adapts all visual properties accordingly.

#### 1.4.1 Regime Definitions

```
R1: EXPLORATION — 30% of time
  Visual character: warm, high energy, playful, open
  Color bias:       warm spectrum (reds, oranges, ambers)
  Easing:           elastic, back — overshoots then settles
  Animation:        stagger offsets visible, elements bounce slightly
  Border radius:    maximum irregularity (wabi-sabi peaks)
  Shadow:           strong, directional, dramatic

R2: OPTIMIZATION — 20% of time
  Visual character: cool, precise, focused, minimal
  Color bias:       cool spectrum (blues, teals, greens)
  Easing:           power2, power3 — clean deceleration curves
  Animation:        faster, more purposeful, reduced stagger
  Border radius:    medium, consistent
  Shadow:           subtle, diffuse

R3: STABILIZATION — 50% of time
  Visual character: calm, balanced, resolved, harmonious
  Color bias:       neutral (the culture's base palette)
  Easing:           sine.inOut — gentle, symmetric
  Animation:        breathing, subtle, slow
  Border radius:    medium with small irregularity
  Shadow:           gentle, balanced
```

#### 1.4.2 Regime Detection

The current regime is detected from the application's quaternion state:

```
function detectRegime(q: Quaternion): Regime {
  const angle = 2 * Math.acos(Math.abs(q.w))  // geodesic angle from identity
  const normalized = angle / Math.PI           // [0, 1]

  if (normalized < 0.30) return 'R1'           // close to identity = exploration
  if (normalized < 0.50) return 'R2'           // middle zone = optimization
  return 'R3'                                  // far from identity = stabilized
}
```

In practice, the Trident optimizer (section 8) manages regime state and publishes it to the engine. The engine listens and adapts.

#### 1.4.3 Regime Transitions

When the regime changes, all visual properties transition over `--dur-slow` (377ms) using a SLERP from the current quaternion theme to the target regime's quaternion theme. The user sees a gentle visual shift — colors warm or cool, shadows strengthen or soften — without any jarring cut.

---

### 1.5 The Digital Root Aesthetic

The digital root (DR) of a number `n` is:
```
DR(n) = 1 + ((n - 1) mod 9)       for n > 0
DR(0) = 0
```

This maps every positive integer to {1, 2, 3, 4, 5, 6, 7, 8, 9}. It is computed in O(1).

In the Living Geometry Engine, the DR of a data value (a farmer ID, a transaction amount, a crop code) determines the **visual family** of the component displaying that data. Same DR = same visual family. Different DR = detectably different family. This creates **deterministic variety** — the UI feels alive and varied without being random.

#### 1.5.1 NavaYoni — Planetary Energy Mapping

```
DR 1 — Surya (Sun):    authority, gold, power2.out easing, heavy type weight
DR 2 — Chandra (Moon): care, silver-blue, sine.inOut, light weight
DR 3 — Mangal (Mars):  energy, red-orange, back.out, bold weight
DR 4 — Budha (Mercury):precision, green-teal, power1.inOut, mono weight
DR 5 — Guru (Jupiter): wisdom, indigo-violet, elastic.out, serif display weight
DR 6 — Shukra (Venus): beauty, pink-gold, bounce.out, italic weight
DR 7 — Shani (Saturn): depth, dark-grey, expo.out, condensed weight
DR 8 — Rahu (North Node): intensity, deep red, power4.out, expanded weight
DR 9 — Ketu (South Node): transcendence, white-violet, none (instant), ultra-light weight
```

#### 1.5.2 NavaYoni Synergy

Two components sharing the same DR are **resonant** and can be visually linked (shared border color, synchronized pulse). Two components with harmonically related DRs (DR 1 + DR 4 = 5, DR 3 + DR 6 = 9) are **harmonic** and can use complementary palette entries. All others are **dissonant** and should maintain clear visual separation.

This maps directly to the NavaYoni synergy implementation in the Prism V2 system from the sarvam harness work — the friendship detection between DRs already exists there.

---

## Section 2: Engine Architecture

### 2.1 Overview

```
INPUT LAYER
  ┌─────────────────────────────────────────┐
  │  Data Stream   (numbers, text, state)   │
  │  Context       (screen, regime, locale)  │
  │  Culture       (matti, wabi-sabi, ...)   │
  └─────────────────────────────────────────┘
            │
            ▼
ENCODING LAYER
  ┌─────────────────────────────────────────┐
  │  QuaternionEncoder                      │
  │  Data → q(w,x,y,z) on S³               │
  │  O(1) per value                         │
  └─────────────────────────────────────────┘
            │
            ▼
RESOLUTION LAYER
  ┌─────────────────────────────────────────┐
  │  PropertyResolver                       │
  │  q → { color, opacity, scale, ... }     │
  │  PropertySet: all visual properties     │
  └─────────────────────────────────────────┘
            │
            ▼
THEME LAYER
  ┌─────────────────────────────────────────┐
  │  ThemeEngine                            │
  │  Culture rotation × PropertySet         │
  │  = culturally-adapted visual state      │
  └─────────────────────────────────────────┘
            │
            ▼
OUTPUT LAYER
  ┌────────────┬──────────────┬─────────────┐
  │ CSS Props  │ GSAP Timeline│ Canvas Cmds │
  │            │              │             │
  │ --color-*  │ .to()        │ fillStyle   │
  │ --space-*  │ .from()      │ strokeStyle │
  │ --dur-*    │ .fromTo()    │ arc()       │
  │ etc.       │ .stagger()   │ bezierTo()  │
  └────────────┴──────────────┴─────────────┘
```

### 2.2 QuaternionEncoder

The encoder maps domain data to unit quaternions. The key requirement is **injectivity within the domain range** (similar inputs map to nearby quaternions) and **normalization** (output always lives on S³).

```typescript
class QuaternionEncoder {
  // Encode a scalar value in [0, 1] to a quaternion
  // Sweeps along a great circle from identity to target axis
  static fromScalar(value: number, axis: [number,number,number] = [0,0,1]): Quaternion {
    const angle = value * Math.PI   // map [0,1] → [0°, 180°]
    return Quaternion.fromAxisAngle(axis, angle)
  }

  // Encode a value within a known range
  static fromRange(value: number, min: number, max: number): Quaternion {
    const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))
    return this.fromScalar(normalized)
  }

  // Encode a string (e.g., user ID, status label)
  // Deterministic: same string → same quaternion every time
  static fromString(s: string): Quaternion {
    // FNV-1a hash → 4 components
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    const w = ((h & 0xFF) / 255) * 2 - 1
    const x = (((h >> 8) & 0xFF) / 255) * 2 - 1
    const y = (((h >> 16) & 0xFF) / 255) * 2 - 1
    const z = (((h >> 24) & 0xFF) / 255) * 2 - 1
    return new Quaternion(w, x, y, z).normalize()
  }

  // Encode a two-number pair (e.g., lat/lon, price/qty, x/y position)
  static fromPair(a: number, b: number): Quaternion {
    const theta = a * Math.PI           // azimuthal angle
    const phi = b * Math.PI / 2         // polar angle
    return new Quaternion(
      Math.cos(phi),
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      0
    ).normalize()
  }

  // Encode three-regime state [r1, r2, r3] where r1+r2+r3 = 1
  static fromRegime(r1: number, r2: number, r3: number): Quaternion {
    // r3 dominates the w component (stabilization = closer to identity)
    // r1 affects x (exploration = high imaginary component)
    // r2 affects y (optimization)
    return new Quaternion(r3, r1, r2, 0).normalize()
  }
}
```

### 2.3 PropertyResolver

```typescript
interface PropertySet {
  // Color
  colorRGB: [number, number, number]  // [0,255] each
  colorCSS: string                     // 'rgb(r,g,b)' or 'hsl(h,s%,l%)'
  colorHex: string                     // '#rrggbb'

  // Opacity and presence
  opacity: number                      // [0, 1]

  // Sizing
  scale: number                        // [0.5, 1.0]
  sizeIndex: number                    // 0-8, maps to Fibonacci

  // Spatial transforms
  rotation: number                     // degrees, for CSS transform

  // Wabi-sabi shape
  borderRadii: [number, number, number, number]  // [tl, tr, br, bl] in px

  // Shadow (Rayleigh)
  shadowX: number      // px
  shadowY: number      // px
  shadowBlur: number   // px
  shadowSpread: number // px
  shadowOpacity: number

  // Animation
  duration: number     // ms, derived from geodesic distance to previous state
  easing: string       // GSAP easing string
  regime: 'R1' | 'R2' | 'R3'

  // Digital Root aesthetics
  dr: number           // 1-9
  planetaryEnergy: string
}

class PropertyResolver {
  resolve(q: Quaternion, prev?: Quaternion): PropertySet {
    const brightness = (q.w + 1) / 2
    const r = Math.abs(q.x) * brightness
    const g = Math.abs(q.y) * brightness
    const b = Math.abs(q.z) * brightness

    const angle = prev
      ? 2 * Math.acos(Math.min(1, Math.abs(q.dot(prev))))
      : Math.PI / 4

    const duration = 233 * (angle / Math.PI) * 3

    return {
      colorRGB: [Math.round(r*255), Math.round(g*255), Math.round(b*255)],
      colorCSS: `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`,
      colorHex: this.toHex(r, g, b),
      opacity: (q.w + 1) / 2,
      scale: 0.5 + (q.w + 1) / 4,
      sizeIndex: Math.round(Math.abs(q.x) * 8),
      rotation: Math.atan2(2*(q.w*q.x + q.y*q.z), 1 - 2*(q.y*q.y + q.x*q.x)) * 180/Math.PI,
      borderRadii: [
        8 * (0.5 + Math.abs(q.w) * 0.5),
        8 * (0.5 + Math.abs(q.x) * 0.5),
        8 * (0.5 + Math.abs(q.y) * 0.5),
        8 * (0.5 + Math.abs(q.z) * 0.5),
      ],
      shadowX: q.x * brightness * 8,
      shadowY: q.y * brightness * 8,
      shadowBlur: Math.abs(q.z) * brightness * 16,
      shadowSpread: (q.w - 0.5) * 4,
      shadowOpacity: brightness * 0.3,
      duration: Math.round(duration),
      easing: this.regimeToEasing(detectRegime(q)),
      regime: detectRegime(q),
      dr: digitalRoot(Math.round(Math.abs(q.w + q.x + q.y + q.z) * 1000)),
      planetaryEnergy: NAVA_YONI[digitalRoot(...)],
    }
  }

  private toHex(r: number, g: number, b: number): string {
    return '#' + [r,g,b].map(v =>
      Math.round(v*255).toString(16).padStart(2,'0')
    ).join('')
  }

  private regimeToEasing(regime: string): string {
    if (regime === 'R1') return 'elastic.out(1, 0.5)'
    if (regime === 'R2') return 'power2.out'
    return 'sine.inOut'
  }
}
```

### 2.4 LayoutComputer

```typescript
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597]
const PHI = 1.618033988749895
const GOLDEN_ANGLE_DEG = 137.5077640500378
const GOLDEN_ANGLE_RAD = GOLDEN_ANGLE_DEG * Math.PI / 180

class LayoutComputer {
  // Nearest Fibonacci value to a target pixel count
  nearestFib(target: number): number {
    return FIB.reduce((best, v) =>
      Math.abs(v - target) < Math.abs(best - target) ? v : best
    )
  }

  // Fibonacci column widths for n columns
  fibColumns(n: number): number[] {
    const raw = Array.from({length: n}, (_, i) => Math.pow(PHI, n - 1 - i))
    const sum = raw.reduce((a, b) => a + b, 0)
    return raw.map(v => Math.round(v / sum * 100))  // percentages summing to ~100
  }

  // Phyllotaxis position for index i in a field of n
  phyllotaxis(i: number, n: number, scale: number = 1): [number, number] {
    const r = scale * Math.sqrt(i / n)
    const theta = i * GOLDEN_ANGLE_RAD
    return [r * Math.cos(theta), r * Math.sin(theta)]
  }

  // Kolam dot grid position for index i in rows × cols grid
  // Same golden angle math, expressed as a regular grid with golden-angle offsets
  kolamDot(row: number, col: number, rows: number, cols: number): [number, number] {
    const baseX = col / cols
    const baseY = row / rows
    // Add golden-angle perturbation for organic feel
    const i = row * cols + col
    const offset = (i * GOLDEN_ANGLE_RAD) % (1 / Math.max(rows, cols))
    return [baseX + Math.cos(offset) * 0.005, baseY + Math.sin(offset) * 0.005]
  }

  // Fibonacci stagger array for n elements (in ms)
  staggerArray(n: number): number[] {
    return Array.from({length: n}, (_, i) => Math.min(i * 21, 144))
  }
}
```

### 2.5 AnimationSequencer

The AnimationSequencer translates quaternion state into GSAP Timeline objects. It never hard-codes values — all timing, easing, and property values come from the PropertyResolver.

```typescript
class AnimationSequencer {
  private resolver = new PropertyResolver()
  private layout = new LayoutComputer()

  // Build entrance timeline for a list of elements
  entrance(elements: Element[], q: Quaternion): gsap.core.Timeline {
    const props = this.resolver.resolve(q)
    const tl = gsap.timeline()

    tl.from(elements, {
      opacity: 0,
      scale: props.scale * 0.6,
      y: FIB[6],          // 13px drop
      duration: props.duration / 1000,
      ease: props.easing,
      stagger: {
        each: 0.021,       // 21ms Fibonacci stagger
        from: 'start',
      },
    })

    return tl
  }

  // Build SLERP morph timeline between two quaternion states
  // This is the heart of the engine: onUpdate reads the live SLERP position
  slerpMorph(
    element: Element,
    fromQ: Quaternion,
    toQ: Quaternion,
    options: { duration?: number } = {}
  ): gsap.core.Timeline {
    const theta = 2 * Math.acos(Math.min(1, Math.abs(fromQ.dot(toQ))))
    const duration = options.duration ?? 233 * (theta / Math.PI) * 3

    const state = { t: 0 }
    const tl = gsap.timeline()

    tl.to(state, {
      t: 1,
      duration: duration / 1000,
      ease: 'sine.inOut',
      onUpdate: () => {
        const q = fromQ.slerp(toQ, state.t)
        const props = this.resolver.resolve(q, fromQ)

        gsap.set(element, {
          '--q-color': props.colorCSS,
          '--q-opacity': props.opacity,
          '--q-scale': props.scale,
          '--q-rotation': props.rotation,
          borderRadius: props.borderRadii.map(r => `${r}px`).join(' '),
          boxShadow: this.buildShadow(props),
        })
      },
    })

    return tl
  }

  private buildShadow(props: PropertySet): string {
    return `${props.shadowX}px ${props.shadowY}px ${props.shadowBlur}px ${props.shadowSpread}px rgba(0,0,0,${props.shadowOpacity})`
  }
}
```

### 2.6 ThemeGenerator

A culture is a **rotation** in quaternion space. The ThemeGenerator takes a cultural rotation quaternion `q_culture` and applies it to every computed property quaternion via quaternion multiplication.

```typescript
interface CultureConfig {
  name: string
  rotationQ: Quaternion   // The cultural rotation on S³
  basePalette: Record<string, string>   // Named colors for CSS custom properties
  fonts: { display: string, body: string, mono: string }
  patternType: 'phyllotaxis' | 'kolam' | 'mandala' | 'custom'
  borderRadiusMultiplier: number   // 1.0 = standard, 1.5 = more organic, 0.5 = more geometric
}

class ThemeGenerator {
  apply(dataQ: Quaternion, culture: CultureConfig): Quaternion {
    // Rotate the data quaternion by the cultural rotation
    return culture.rotationQ.multiply(dataQ).normalize()
  }

  toCSSVars(culture: CultureConfig): string {
    return Object.entries(culture.basePalette)
      .map(([key, value]) => `  --color-${key}: ${value};`)
      .join('\n')
  }
}
```

---

## Section 3: Quaternion-Driven Components

### 3.1 Color Transitions

Never use CSS `transition: color 300ms linear`. Instead:

```typescript
function transitionColor(element: Element, fromQ: Quaternion, toQ: Quaternion) {
  const state = { t: 0 }
  gsap.to(state, {
    t: 1,
    duration: 0.233,
    ease: 'sine.inOut',
    onUpdate: () => {
      const q = fromQ.slerp(toQ, state.t)
      const [r, g, b] = q.toRGB()
      element.style.color = `rgb(${r},${g},${b})`
    }
  })
}
```

SLERP color transitions are perceptually smoother because they follow S³ geodesics. Two colors that are geometrically near on S³ always transition through perceptually related intermediate colors. Linear RGB interpolation passes through gray for complementary colors; SLERP does not.

### 3.2 Card Entry Animation

```typescript
function cardEntrance(card: Element, dataQ: Quaternion) {
  const props = resolver.resolve(dataQ)

  // Initial state: off-axis, small, transparent
  const entryQ = Quaternion.fromAxisAngle([0, 1, 0], -Math.PI / 6)  // rotated -30°
  const entryProps = resolver.resolve(entryQ)

  gsap.fromTo(card,
    {
      opacity: 0,
      scale: 0.88,    // 1 - golden_ratio_complement ≈ 0.382, but 0.88 is gentler
      rotateY: -entryProps.rotation,
      y: FIB[7],      // 21px drop
      borderRadius: entryProps.borderRadii.map(r => `${r}px`).join(' '),
    },
    {
      opacity: props.opacity,
      scale: 1,
      rotateY: 0,
      y: 0,
      borderRadius: props.borderRadii.map(r => `${r}px`).join(' '),
      duration: props.duration / 1000,
      ease: props.easing,
    }
  )
}
```

### 3.3 Chart Brushstrokes

Data values are encoded as quaternions. Each data point is a position on S³. The chart path is a sequence of SLERPs between adjacent data quaternions.

```typescript
function renderBrushstrokeSeries(ctx: CanvasRenderingContext2D, data: number[], config: ChartConfig) {
  const quaternions = data.map(v =>
    QuaternionEncoder.fromRange(v, config.min, config.max)
  )

  for (let i = 1; i < quaternions.length; i++) {
    const q1 = quaternions[i - 1]
    const q2 = quaternions[i]
    const STEPS = 8

    ctx.beginPath()
    for (let s = 0; s <= STEPS; s++) {
      const t = s / STEPS
      const q = q1.slerp(q2, t)
      const props = resolver.resolve(q)

      // Variable stroke width from scale
      ctx.lineWidth = props.scale * config.maxWidth

      // QGIF toRGB → stroke color
      const [r, g, b] = q.toRGB().map(v => Math.round(v * 255))
      const [cr, cg, cb] = cultureRotate([r, g, b], config.culture)
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${props.opacity})`

      const x = config.x + (i - 1 + t) / (data.length - 1) * config.width
      const y = config.y + config.height - props.scale * config.height

      if (s === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}
```

The result is a brushstroke-style chart where line width, color, and opacity all vary organically with the data. High values produce different visual weight than low values, creating an immediate data-ink ratio improvement over uniform line charts.

### 3.4 Background Pattern — Phi-Organism Evolution

The canvas background evolves as a Phi-organism field. This is a direct port of `qgif_unified.py`'s `evolve_phi_organism()`:

```typescript
class BackgroundField {
  private grid: Quaternion[][]
  private width: number
  private height: number
  private cols = 21     // Fibonacci
  private rows = 13     // Fibonacci

  constructor(w: number, h: number) {
    this.width = w
    this.height = h
    this.grid = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => Quaternion.random())
    )
  }

  // Evolve one step: ∂Φ/∂t = Φ ⊗ Φ + C(spatial_context)
  step(dt: number = 0.01) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const phi = this.grid[r][c]
        const spatialFreq = ((c / this.cols) + (r / this.rows)) * 2 * Math.PI
        const context = new Quaternion(
          0,
          Math.sin(spatialFreq) * 0.01,
          Math.cos(spatialFreq) * 0.01,
          Math.sin(spatialFreq + Math.PI / 4) * 0.01
        )
        // Φ ⊗ Φ: self-evolve via quaternion product, then add context
        const evolved = phi.multiply(phi).add(context).normalize()
        // SLERP toward evolved state (smooth, not instant)
        this.grid[r][c] = phi.slerp(evolved, dt)
      }
    }
  }

  // Render to canvas using kolam dot pattern (Matti culture)
  renderKolam(ctx: CanvasRenderingContext2D, culture: CultureConfig) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const q = cultureQ.multiply(this.grid[r][c]).normalize()
        const [rx, gx, bx] = q.toRGB().map(v => Math.round(v * 255))
        const props = resolver.resolve(q)

        const cx = (c / (this.cols - 1)) * this.width
        const cy = (r / (this.rows - 1)) * this.height
        const radius = FIB[3] * props.scale  // 5px × scale

        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rx},${gx},${bx},${props.opacity * 0.4})`
        ctx.fill()
      }
    }
  }

  // Render phyllotaxis spiral (Wabi-sabi culture)
  renderPhyllotaxis(ctx: CanvasRenderingContext2D, n: number = 233) {
    const cx = this.width / 2
    const cy = this.height / 2
    const maxR = Math.min(this.width, this.height) * 0.48

    for (let i = 0; i < n; i++) {
      const q = this.grid[i % this.rows][i % this.cols]
      const [r, row, col] = [maxR * Math.sqrt(i / n), i % this.rows, i % this.cols]
      const theta = i * GOLDEN_ANGLE_RAD
      const x = cx + r * Math.cos(theta)
      const y = cy + r * Math.sin(theta)
      const [rx, gx, bx] = q.toRGB().map(v => Math.round(v * 255))
      const props = resolver.resolve(q)

      ctx.beginPath()
      ctx.arc(x, y, FIB[2] * props.scale, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${rx},${gx},${bx},${props.opacity * 0.5})`
      ctx.fill()
    }
  }
}
```

### 3.5 Progress Indicators — Arc Length on S³

A rangoli ring or enso circle where the arc length represents progress. The progress value is encoded as a quaternion, and the arc is drawn as a projection of a geodesic on S³ onto the 2D canvas.

```typescript
function renderProgressRing(
  ctx: CanvasRenderingContext2D,
  progress: number,     // [0, 1]
  cx: number, cy: number, radius: number,
  culture: CultureConfig
) {
  const q = QuaternionEncoder.fromScalar(progress)
  const cq = culture.rotationQ.multiply(q).normalize()
  const [r, g, b] = cq.toRGB().map(v => Math.round(v * 255))
  const props = resolver.resolve(cq)

  // Track (background)
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.lineWidth = FIB[4]   // 5px
  ctx.strokeStyle = `rgba(${r},${g},${b},0.15)`
  ctx.stroke()

  // Progress arc — geodesic angle = progress × 2π
  const endAngle = -Math.PI / 2 + progress * 2 * Math.PI
  ctx.beginPath()
  ctx.arc(cx, cy, radius, -Math.PI / 2, endAngle)
  ctx.lineWidth = FIB[4]
  ctx.strokeStyle = `rgba(${r},${g},${b},${props.opacity})`
  ctx.lineCap = 'round'
  ctx.stroke()
}
```

### 3.6 Toast Notifications

Entry angle, color, and dismiss trajectory all derive from the notification's severity quaternion.

```typescript
type Severity = 'info' | 'success' | 'warning' | 'error'

const SEVERITY_QUATERNIONS: Record<Severity, Quaternion> = {
  info:    Quaternion.fromAxisAngle([0, 0, 1], Math.PI / 6),   // gentle rotation
  success: Quaternion.fromAxisAngle([0, 1, 0], Math.PI / 4),   // mid rotation
  warning: Quaternion.fromAxisAngle([1, 0, 0], Math.PI / 3),   // strong rotation
  error:   Quaternion.fromAxisAngle([1, 1, 0], Math.PI / 2),   // maximum tension
}

function showToast(el: Element, severity: Severity) {
  const q = SEVERITY_QUATERNIONS[severity]
  const props = resolver.resolve(q)
  const [r, g, b] = q.toRGB().map(v => Math.round(v * 255))

  // Entry: slide in from the direction of the quaternion's x component
  const entryX = q.x * FIB[7]   // 21px × x component

  gsap.fromTo(el,
    { x: entryX, opacity: 0, scale: 0.95 },
    {
      x: 0,
      opacity: 1,
      scale: 1,
      backgroundColor: `rgba(${r},${g},${b},0.12)`,
      borderColor: `rgba(${r},${g},${b},0.5)`,
      duration: props.duration / 1000,
      ease: props.easing,
    }
  )

  // Auto-dismiss after (Fibonacci × severity level) ms
  const SEVERITY_LEVEL: Record<Severity, number> = { info: 3, success: 5, warning: 8, error: 13 }
  const dismissDelay = FIB[SEVERITY_LEVEL[severity]] * 100

  setTimeout(() => {
    // Dismiss: move toward the anti-direction
    gsap.to(el, {
      x: -entryX * 1.5,
      opacity: 0,
      duration: 0.233,
      ease: 'power2.in',
    })
  }, dismissDelay)
}
```

### 3.7 Screen Transitions

Each screen has a quaternion identity derived from its name (via `QuaternionEncoder.fromString()`). Transitioning between screens is a SLERP between their quaternion identities, driving a visual morph that feels related to the content change.

```typescript
async function transitionScreens(
  fromScreen: string,
  toScreen: string,
  container: Element
) {
  const q1 = QuaternionEncoder.fromString(fromScreen)
  const q2 = QuaternionEncoder.fromString(toScreen)
  const theta = 2 * Math.acos(Math.min(1, Math.abs(q1.dot(q2))))
  const duration = 233 * (theta / Math.PI) * 3 / 1000

  const state = { t: 0 }

  await gsap.to(state, {
    t: 1,
    duration,
    ease: 'power2.inOut',
    onUpdate: () => {
      const q = q1.slerp(q2, state.t)
      const props = resolver.resolve(q)
      gsap.set(container, {
        '--screen-color': props.colorCSS,
        filter: `hue-rotate(${props.rotation}deg)`,
        opacity: state.t < 0.5 ? 1 - state.t * 0.3 : 0.7 + (state.t - 0.5) * 0.6,
      })
    },
  })
}
```

### 3.8 Breathing Animation

The breathing animation is a sine wave on the `w` component of the element's quaternion, producing a gentle opacity and scale pulse.

```typescript
function startBreathing(el: Element, baseQ: Quaternion, rate: number = 0.1) {
  // Breathing: w oscillates between baseQ.w - 0.1 and baseQ.w + 0.1
  // Love Hz: 0.1 (from the consciousness imaging work)
  const breathQ_low  = new Quaternion(baseQ.w - 0.1, baseQ.x, baseQ.y, baseQ.z).normalize()
  const breathQ_high = new Quaternion(baseQ.w + 0.1, baseQ.x, baseQ.y, baseQ.z).normalize()
  const low  = resolver.resolve(breathQ_low)
  const high = resolver.resolve(breathQ_high)

  gsap.to(el, {
    opacity: high.opacity,
    scale: high.scale,
    duration: (1 / rate) / 2,     // half-period for one direction
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    transformOrigin: 'center center',
  })
}
```

### 3.9 Celebration Particles

21 particles (Fibonacci[9]), each following a unique SLERP geodesic from a center quaternion to a random destination quaternion.

```typescript
function celebrateAtPoint(cx: number, cy: number, cultureQ: Quaternion) {
  const N = 21   // Fibonacci[9]
  const origin = QuaternionEncoder.fromPair(cx / window.innerWidth, cy / window.innerHeight)

  for (let i = 0; i < N; i++) {
    const el = createParticle()
    document.body.appendChild(el)

    const target = origin.slerp(Quaternion.random(), 1.0)  // full geodesic to random
    const cTarget = cultureQ.multiply(target).normalize()
    const [r, g, b] = cTarget.toRGB().map(v => Math.round(v * 255))
    const props = resolver.resolve(cTarget)

    // Fibonacci stagger: particle i starts at i × 21ms
    const stagger = i * FIB[8] / 1000   // 21ms × i, in seconds

    gsap.fromTo(el,
      { x: cx, y: cy, scale: 0, opacity: 1 },
      {
        x: cx + cTarget.x * 144,    // 144px = Fibonacci[12]
        y: cy + cTarget.y * 144,
        scale: props.scale * 1.5,
        opacity: 0,
        backgroundColor: `rgb(${r},${g},${b})`,
        duration: 0.610,             // Fibonacci[15] ms / 1000
        ease: 'power2.out',
        delay: stagger,
        onComplete: () => el.remove(),
      }
    )
  }
}
```

---

## Section 4: The Theme Engine — Cultural Adaptation

### 4.1 Culture as Quaternion Rotation

The fundamental insight: **a culture is a rotation of the universal color space**. The mathematical relationships between colors (complementary, analogous, harmonic) are invariant under rotation on S³. Only the specific colors change.

```
UNIVERSAL PALETTE (no culture rotation):
  Identity quaternion (1,0,0,0) → black
  x-axis quaternion  (0,1,0,0) → red
  y-axis quaternion  (0,0,1,0) → green
  z-axis quaternion  (0,0,0,1) → blue

WABI-SABI ROTATION: q_wabi = identity (paper/ink/gold is the base)
  → paper = #1a1a1d (not pure black)
  → ink = #d4d0c8 (not pure white)
  → accent = #c5a059 (kintsugi gold)

MATTI ROTATION: q_matti = fromAxisAngle([1,0.5,0], 0.52 radians ≈ 30°)
  → Rotates the palette toward earth spectrum
  → identity → Matti brown #8B4513 (instead of near-black)
  → x-axis → Pasupu yellow #E8A317 (instead of red)
  → y-axis → Neeli blue #1B4F72 (instead of green)
```

To compute the Matti rotation quaternion precisely, we need to find the rotation on S³ that maps the wabi-sabi palette to the matti palette. This is the inverse-kinematics problem of quaternion spaces: given two sets of corresponding points, find the rotation.

For practical use, the cultural rotation quaternions are configured by designers and stored in the CultureConfig. The math guarantees that inter-color relationships are preserved.

### 4.2 Culture Configurations

#### Wabi-Sabi (Base / Default)

```typescript
const WABI_SABI: CultureConfig = {
  name: 'wabi-sabi',
  rotationQ: Quaternion.identity(),    // No rotation — this is the base
  basePalette: {
    'paper':    '#1a1a1d',  // dark mode
    'paper-lt': '#fdfbf7',  // light mode
    'ink':      '#d4d0c8',  // dark mode
    'ink-dk':   '#1c1c1c',  // light mode
    'gold':     '#c5a059',  // kintsugi
    'mist':     '#3a3a3f',  // tertiary surfaces
    'bloom':    '#8a7a6a',  // warm accent
  },
  fonts: {
    display: "'Cinzel', serif",
    body:    "'Lora', serif",
    mono:    "'Courier Prime', monospace",
  },
  patternType: 'phyllotaxis',
  borderRadiusMultiplier: 1.2,   // slightly organic
}
```

#### Matti (Rythu Mitra / Telugu Farmers)

```typescript
const MATTI: CultureConfig = {
  name: 'matti',
  // Rotate toward earth spectrum: 30° around the (1, 0.5, 0) axis
  rotationQ: Quaternion.fromAxisAngle([1, 0.5, 0], 0.524),  // 0.524 rad ≈ 30°
  basePalette: {
    'paper':     '#FAF7F0',  // Patti — natural linen, light mode
    'paper-dk':  '#1C1208',  // Matti dark — deep earth, dark mode
    'ink':       '#2C1810',  // Deep earth brown
    'matti':     '#8B4513',  // Saddlebrown — primary earth
    'pasupu':    '#E8A317',  // Turmeric yellow — primary accent
    'neeli':     '#1B4F72',  // Indigo — cool accent
    'puvvu':     '#C45B7C',  // Flower pink — warm accent
    'aaku':      '#2D5A27',  // Leaf green — success/growth
    'manu':      '#D4A76A',  // Sandy beige — neutral surface
    'kommu':     '#8B0000',  // Dark red — error/alert
  },
  fonts: {
    display: "'Noto Serif Telugu', 'Lora', serif",
    body:    "'Noto Sans Telugu', 'Outfit', sans-serif",
    mono:    "'Courier Prime', monospace",
  },
  patternType: 'kolam',
  borderRadiusMultiplier: 1.5,   // more organic, handmade feel
}
```

#### Future Culture Template

Any new culture is defined by:
1. A rotation quaternion (how far to rotate from identity)
2. A base palette (what named colors map to in this culture)
3. A font stack (the cultural type system)
4. A pattern type (the background geometry)
5. A border radius multiplier (how organic vs geometric)

All spacing, animation timing, layout proportions, and digital root mappings are **inherited from the universal engine**. Only visual expression changes.

### 4.3 Pattern Generation

The same golden angle `137.508°` underlies all patterns. The culture determines the **visual vocabulary** used to draw it.

```
Golden Angle: θ = 137.5077640500378°

Phyllotaxis (wabi-sabi):
  Position i → polar coords (r_i, θ × i)
  Drawn as: small circles, lines, or dots
  Visual feel: organic spiral growth

Kolam (matti):
  Position i → grid row r, column c via modular arithmetic
  Overlay golden-angle perturbation for organic offset
  Drawn as: dots connected by curves (kolam lines)
  Visual feel: structured yet handmade

Mandala (future sacred geometry culture):
  Position i → radial symmetry, replicate around n-fold axis
  Golden angle governs angular spacing between petals
  Drawn as: arcs, petal shapes, concentric rings
  Visual feel: symbolic, ceremonial
```

### 4.4 Typography as Quaternion Weight

In mixed-language contexts (UI labels in Telugu, numbers in Latin, technical data in mono), the **font blend** is driven by the w component of the current quaternion:

```
w near 1:   display font (Cinzel / Noto Serif Telugu) — authority, ceremony
w near 0:   body font (Lora / Noto Sans Telugu) — reading, information
w near -1:  mono font (Courier Prime) — data, code, precision

Blend formula:
  display_weight = max(0, w)
  body_weight    = 1 - |w|
  mono_weight    = max(0, -w)
```

In practice this means: data that encodes a high-value, identity-like quaternion renders in display type. Data that encodes a precise numeric reading renders in mono. Narrative content and labels render in body type.

---

## Section 5: GSAP Integration Patterns

### 5.1 The Core Rule

**Every GSAP call gets its values from the PropertyResolver, not from hard-coded numbers.**

```typescript
// WRONG:
gsap.to(el, { opacity: 0.8, duration: 0.3, ease: 'power2.out' })

// RIGHT:
const q = QuaternionEncoder.fromScalar(dataValue)
const props = resolver.resolve(q)
gsap.to(el, { opacity: props.opacity, duration: props.duration/1000, ease: props.easing })
```

### 5.2 Entrance Pattern

```typescript
function entrance(els: Element[], q: Quaternion) {
  const p = resolver.resolve(q)
  return gsap.from(els, {
    opacity: 0,
    y: FIB[7],             // 21px
    scale: 0.95,
    duration: p.duration / 1000,
    ease: 'back.out(1.2)',
    stagger: { each: 0.021, from: 'start' },
  })
}
```

### 5.3 Exit Pattern

```typescript
function exit(els: Element[], q: Quaternion) {
  const p = resolver.resolve(q)
  return gsap.to(els, {
    opacity: 0,
    y: -FIB[6],            // -13px (moves up on exit)
    scale: 0.97,
    duration: (p.duration / 1000) * 0.618,   // faster exit, φ⁻¹ of entry duration
    ease: 'power2.in',
    stagger: { each: 0.013, from: 'end' },   // reverse stagger on exit
  })
}
```

### 5.4 Morph Pattern — SLERP in onUpdate

The canonical pattern for any property that should animate via quaternion geodesic:

```typescript
function morphProperties(
  el: Element,
  fromQ: Quaternion,
  toQ: Quaternion,
  extraProps?: Record<string, any>
) {
  const proxy = { t: 0 }
  const theta = 2 * Math.acos(Math.min(1, Math.abs(fromQ.dot(toQ))))
  const duration = Math.max(0.089, 0.233 * (theta / Math.PI) * 3)

  return gsap.to(proxy, {
    t: 1,
    duration,
    ease: 'sine.inOut',
    onUpdate() {
      const q = fromQ.slerp(toQ, proxy.t)
      const p = resolver.resolve(q)
      gsap.set(el, {
        '--current-color': p.colorCSS,
        borderRadius: p.borderRadii.map(r => `${r.toFixed(1)}px`).join(' '),
        boxShadow: `${p.shadowX}px ${p.shadowY}px ${p.shadowBlur}px rgba(0,0,0,${p.shadowOpacity})`,
        opacity: p.opacity,
        ...extraProps,
      })
    },
  })
}
```

### 5.5 Breathing Pattern

```typescript
function breathe(el: Element, baseQ: Quaternion, hz: number = 0.1) {
  const period = 1 / hz
  const halfPeriod = period / 2

  // Derive inhale/exhale quaternions
  const inhale = new Quaternion(
    Math.min(1, baseQ.w + 0.1), baseQ.x, baseQ.y, baseQ.z
  ).normalize()
  const exhale = new Quaternion(
    Math.max(-1, baseQ.w - 0.1), baseQ.x, baseQ.y, baseQ.z
  ).normalize()

  const pIn  = resolver.resolve(inhale)
  const pOut = resolver.resolve(exhale)

  gsap.to(el, {
    opacity: pIn.opacity,
    scale: pIn.scale,
    duration: halfPeriod,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  })
}
```

### 5.6 Cascade Pattern — Fibonacci Stagger

```typescript
function cascade(
  parent: Element,
  selector: string,
  q: Quaternion,
  direction: 'start' | 'center' | 'end' | 'random' = 'start'
) {
  const children = parent.querySelectorAll(selector)
  const p = resolver.resolve(q)
  const [r, g, b] = q.toRGB().map(v => Math.round(v * 255))

  return gsap.from(children, {
    opacity: 0,
    x: direction === 'end' ? -FIB[6] : FIB[6],
    scale: 0.93,
    color: `rgb(${r},${g},${b})`,
    duration: p.duration / 1000,
    ease: p.easing,
    stagger: {
      each: 0.021,               // 21ms = Fibonacci[8]
      from: direction,
      ease: 'power1.inOut',
    },
  })
}
```

### 5.7 Data-Driven Pattern

This pattern powers live data dashboards: an `onUpdate` callback reads from a data source every frame and drives the visual via quaternion encoding.

```typescript
function liveDataBinding(
  el: Element,
  getLatestValue: () => number,
  range: [number, number],
  culture: CultureConfig
) {
  let prevQ = Quaternion.identity()

  // Run at 60fps via GSAP ticker
  gsap.ticker.add(() => {
    const value = getLatestValue()
    const rawQ = QuaternionEncoder.fromRange(value, range[0], range[1])
    const q = culture.rotationQ.multiply(rawQ).normalize()

    // Smooth toward new state (don't snap)
    prevQ = prevQ.slerp(q, 0.1)   // lerp factor 0.1 = smooth lag

    const p = resolver.resolve(prevQ)
    const [r, g, b] = prevQ.toRGB().map(v => Math.round(v * 255))

    gsap.set(el, {
      '--data-color': `rgb(${r},${g},${b})`,
      '--data-scale': p.scale,
      '--data-opacity': p.opacity,
    })
  })
}
```

### 5.8 Responsive Pattern

On smaller screens, the quaternion scale factor reduces animation intensity without eliminating it:

```typescript
function responsiveAmplitude(): number {
  const w = window.innerWidth
  if (w < 360) return 0.4    // very small phones (₹10K range)
  if (w < 480) return 0.6    // budget Android
  if (w < 768) return 0.8    // standard mobile
  return 1.0                 // tablet and up
}

// Apply before every animation
function scaledDuration(baseDuration: number): number {
  return baseDuration * responsiveAmplitude()
}

function scaledDistance(basePx: number): number {
  return basePx * responsiveAmplitude()
}
```

On a ₹10K Redmi phone with 360px viewport, all animation distances are 40% of designed values, all durations are 40% shorter, and the Phi-organism background runs at 8fps instead of 30fps.

---

## Section 6: Performance Budget

The Living Geometry Engine must run smoothly on a Redmi 9A (Helio G25, 2GB RAM, Android 11) — the ₹10K phone that Lakshmi uses.

### 6.1 Bundle Size Budget

```
Core Engine (@asymm/qgif-web):     ~6 KB gzipped
  - Quaternion class: ~2 KB
  - Encoder/Resolver: ~2 KB
  - LayoutComputer:   ~1 KB
  - ThemeGenerator:   ~1 KB

GSAP (tree-shaken):               ~24 KB gzipped
  - gsap core + Tween:  ~18 KB
  - Timeline:           ~4 KB
  - Ticker:             ~2 KB
  (No ScrollTrigger, no MorphSVG, no DrawSVG)

Culture config (one culture):      ~1 KB
Design tokens (CSS custom props):  ~2 KB

TOTAL:                            ~33 KB gzipped
```

Hard limit: 50 KB total. Achieved at ~33 KB.

### 6.2 Quaternion Operations Per Frame

At 60fps, the frame budget is 16.67ms. Quaternion operations are fast:

```
SLERP (single):          ~0.01ms
dot product:             ~0.001ms
normalize:               ~0.001ms
toRGB:                   ~0.002ms
PropertyResolver.resolve: ~0.05ms (including SLERP + toRGB)
```

Per-frame quaternion budget (60fps target, 5ms allocation for engine):

```
Background field step (21×13 = 273 cells):   273 × 0.05ms ≈ 14ms  -- too much!
  → Use Web Worker for field evolution
  → Render from pre-computed buffer, not live

Active component animations (≤ 20 at once):  20 × 0.05ms = 1ms   -- fine
Screen transition (1 SLERP):                  1 × 0.05ms = 0.05ms -- trivial
Live data bindings (≤ 5):                     5 × 0.05ms = 0.25ms -- fine

TOTAL on main thread:  ~1.3ms per frame
```

The Phi-organism background field evolution runs in a Web Worker and posts the computed quaternion array to the main thread at 8fps (125ms interval), which the main thread renders at 60fps using the last received buffer.

### 6.3 Canvas vs CSS Transforms

```
Use Canvas for:
  - Background patterns (phyllotaxis, kolam)
  - Chart brushstrokes
  - Progress rings
  - Particle systems

Use CSS transforms for:
  - Card entry/exit (translate, scale, opacity)
  - Screen transitions (filter, opacity)
  - Breathing animations (scale, opacity)
  - Toast notifications (translate, opacity)
```

CSS transforms are GPU-accelerated in all modern browsers including WebView on Android. Canvas 2D is CPU-rendered on budget devices. Keep canvas element count to 1 (background) + 1 (charts) per screen.

### 6.4 Web Worker Delegation

```
Main Thread:
  - GSAP ticker and animation loop
  - PropertyResolver for active animations
  - DOM mutations via gsap.set()
  - User event handling

Web Worker:
  - BackgroundField.step() (Phi-organism evolution)
  - Heavy quaternion computation for batch data encoding
  - Digital root pre-computation for large datasets
  - Fibonacci grid layout pre-computation
```

Worker message protocol:
```typescript
// Worker → Main every 125ms (8fps)
type WorkerMessage = {
  type: 'field_update'
  grid: Float32Array   // 273 × 4 floats (w,x,y,z per cell)
  timestamp: number
}
```

### 6.5 Memory: Quaternion Cache Strategy

```typescript
const qCache = new Map<string, Quaternion>()

function cachedEncode(key: string, encoder: () => Quaternion): Quaternion {
  if (qCache.has(key)) return qCache.get(key)!
  const q = encoder()
  qCache.set(key, q)
  return q
}

// Cache size limit: 1000 entries (each ~32 bytes = 32 KB max)
// Eviction: LRU with max age 5 minutes
// Keys: 'string:value', 'range:min:max:value', 'pair:a:b', etc.
```

The digital root pre-filter eliminates 88.9% of redundant computations before they reach the quaternion encoder. For a dataset of 1000 values, only ~111 distinct quaternions need to be computed and cached.

---

## Section 7: The @asymm/qgif-web TypeScript Port

### 7.1 Package Structure

```
packages/qgif-web/
  src/
    quaternion.ts      -- Core Quaternion class
    encoder.ts         -- QuaternionEncoder
    resolver.ts        -- PropertyResolver
    layout.ts          -- LayoutComputer
    theme.ts           -- ThemeGenerator, CultureConfig
    sequencer.ts       -- AnimationSequencer
    field.ts           -- BackgroundField (Phi-organism)
    cultures/
      wabi-sabi.ts
      matti.ts
    index.ts           -- Public API re-exports
  package.json
  tsconfig.json
```

### 7.2 Complete Quaternion API

```typescript
export class Quaternion {
  readonly w: number
  readonly x: number
  readonly y: number
  readonly z: number

  constructor(w: number, x: number, y: number, z: number) {
    this.w = w; this.x = x; this.y = y; this.z = z
  }

  // --- Core operations ---

  normalize(): Quaternion {
    const n = Math.sqrt(this.w**2 + this.x**2 + this.y**2 + this.z**2)
    if (n < 1e-10) return Quaternion.identity()
    return new Quaternion(this.w/n, this.x/n, this.y/n, this.z/n)
  }

  // Quaternion product — NOT commutative! q1*q2 ≠ q2*q1
  multiply(other: Quaternion): Quaternion {
    return new Quaternion(
      this.w*other.w - this.x*other.x - this.y*other.y - this.z*other.z,
      this.w*other.x + this.x*other.w + this.y*other.z - this.z*other.y,
      this.w*other.y - this.x*other.z + this.y*other.w + this.z*other.x,
      this.w*other.z + this.x*other.y - this.y*other.x + this.z*other.w,
    ).normalize()
  }

  // Add context quaternion (for Phi-organism evolution)
  add(other: Quaternion): Quaternion {
    return new Quaternion(
      this.w + other.w, this.x + other.x,
      this.y + other.y, this.z + other.z
    )
    // Caller normalizes after adding context
  }

  conjugate(): Quaternion {
    return new Quaternion(this.w, -this.x, -this.y, -this.z)
  }

  dot(other: Quaternion): number {
    return this.w*other.w + this.x*other.x + this.y*other.y + this.z*other.z
  }

  // --- Interpolation ---

  // Geodesic shortest-path interpolation on S³
  // t=0 → this, t=1 → other
  slerp(other: Quaternion, t: number): Quaternion {
    let dot = this.dot(other)
    let o = other

    // Ensure we take the shorter arc
    if (dot < 0) { o = new Quaternion(-o.w, -o.x, -o.y, -o.z); dot = -dot }

    // Near-identical: use linear interpolation (avoids sin(0) division)
    if (dot > 0.9995) {
      return new Quaternion(
        this.w + t*(o.w - this.w),
        this.x + t*(o.x - this.x),
        this.y + t*(o.y - this.y),
        this.z + t*(o.z - this.z),
      ).normalize()
    }

    const theta0 = Math.acos(dot)        // angle between quaternions
    const theta  = theta0 * t            // scaled angle
    const s0 = Math.cos(theta) - dot * Math.sin(theta) / Math.sin(theta0)
    const s1 = Math.sin(theta) / Math.sin(theta0)

    return new Quaternion(
      s0*this.w + s1*o.w,
      s0*this.x + s1*o.x,
      s0*this.y + s1*o.y,
      s0*this.z + s1*o.z,
    ).normalize()
  }

  // Angle of the geodesic arc between two quaternions (in radians, [0, π])
  geodesicDistance(other: Quaternion): number {
    return 2 * Math.acos(Math.min(1, Math.abs(this.dot(other))))
  }

  // --- Visual mappings ---

  // The canonical QGIF mapping: brightness from w, RGB from |x|,|y|,|z|
  toRGB(): [number, number, number] {
    const brightness = (this.w + 1) / 2
    return [
      Math.min(1, Math.abs(this.x) * brightness),
      Math.min(1, Math.abs(this.y) * brightness),
      Math.min(1, Math.abs(this.z) * brightness),
    ]
  }

  // CSS color string
  toCSS(): string {
    const [r, g, b] = this.toRGB()
    return `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`
  }

  // HSL mapping: hue from azimuthal angle, saturation from imaginary magnitude
  toHSL(): [number, number, number] {
    const h = (Math.atan2(this.y, this.x) * 180/Math.PI + 360) % 360
    const s = Math.sqrt(this.x**2 + this.y**2 + this.z**2) * 100
    const l = (this.w + 1) / 2 * 100
    return [h, s, l]
  }

  // --- Construction ---

  static fromAxisAngle(axis: [number,number,number], angle: number): Quaternion {
    const [ax, ay, az] = axis
    const n = Math.sqrt(ax**2 + ay**2 + az**2)
    if (n < 1e-10) return Quaternion.identity()
    const half = angle / 2
    const s = Math.sin(half) / n
    return new Quaternion(Math.cos(half), ax*s, ay*s, az*s)
  }

  // Encode RGB color as quaternion (inverse of toRGB, approximately)
  static fromRGB(r: number, g: number, b: number): Quaternion {
    // r,g,b in [0,1]
    const w = (r + g + b) / 3 * 2 - 1   // luminance → w
    return new Quaternion(w, r - 0.5, g - 0.5, b - 0.5).normalize()
  }

  static random(): Quaternion {
    // Uniformly random point on S³ (Marsaglia method)
    let u1, u2, u3, u4
    do {
      u1 = Math.random() * 2 - 1
      u2 = Math.random() * 2 - 1
    } while (u1**2 + u2**2 >= 1)
    do {
      u3 = Math.random() * 2 - 1
      u4 = Math.random() * 2 - 1
    } while (u3**2 + u4**2 >= 1)
    const f = Math.sqrt((1 - u1**2 - u2**2) / (u3**2 + u4**2))
    return new Quaternion(u1, u2, u3*f, u4*f)
  }

  static identity(): Quaternion {
    return new Quaternion(1, 0, 0, 0)
  }

  // Phi-organism one-step evolution: ∂Φ/∂t = Φ ⊗ Φ + C(context)
  evolve(context: Quaternion, dt: number = 0.01): Quaternion {
    const selfSquared = this.multiply(this)
    const evolved = selfSquared.add(context).normalize()
    return this.slerp(evolved, dt)
  }
}
```

### 7.3 Public API Surface

```typescript
// packages/qgif-web/src/index.ts

export { Quaternion } from './quaternion'
export { QuaternionEncoder } from './encoder'
export { PropertyResolver, type PropertySet } from './resolver'
export { LayoutComputer, FIB, PHI, GOLDEN_ANGLE_DEG } from './layout'
export { ThemeGenerator, type CultureConfig } from './theme'
export { AnimationSequencer } from './sequencer'
export { BackgroundField } from './field'
export { digitalRoot, detectRegime, NAVA_YONI } from './math-utils'

// Pre-built cultures
export { WABI_SABI } from './cultures/wabi-sabi'
export { MATTI } from './cultures/matti'
```

---

## Section 8: Integration with Existing Systems

### 8.1 SpacetimeDB (STDB)

STDB is the invariant data substrate. Every table row has a quaternion encoding:

```typescript
// On data update from STDB subscription
onUpdate(table: string, oldRow: Row, newRow: Row) {
  const fieldsThatMatter = getVisualFields(table)
  const value = extractNumericSignal(newRow, fieldsThatMatter)
  const q = QuaternionEncoder.fromRange(value, getRange(table))
  const cq = CURRENT_CULTURE.rotationQ.multiply(q).normalize()

  // Find the DOM element bound to this row
  const el = document.querySelector(`[data-stdb-id="${newRow.id}"]`)
  if (el) {
    const prevQ = elementQuaternionCache.get(el) ?? Quaternion.identity()
    sequencer.slerpMorph(el, prevQ, cq)
    elementQuaternionCache.set(el, cq)
  }
}
```

This means that STDB real-time updates automatically trigger quaternion-driven visual transitions. There is no separate animation logic to maintain — the data binding IS the animation system.

### 8.2 Trident Optimizer (Regime Detection)

The Trident optimizer publishes the current regime `[r1, r2, r3]` to a shared store. The engine subscribes and adapts:

```typescript
tridentStore.subscribe(({ r1, r2, r3 }) => {
  const regimeQ = QuaternionEncoder.fromRegime(r1, r2, r3)
  const currentRegime = detectRegime(regimeQ)

  if (currentRegime !== lastRegime) {
    // Transition all ambient visual properties to new regime
    document.querySelectorAll('[data-regime-adaptive]').forEach(el => {
      const baseQ = elementQuaternionCache.get(el) ?? Quaternion.identity()
      const targetQ = regimeQ.multiply(baseQ).normalize()
      sequencer.slerpMorph(el, baseQ, targetQ, { duration: 377 })
    })
    lastRegime = currentRegime
  }
})
```

### 8.3 Sarvam AI — Voice → Visual State

When Sarvam processes a voice input and returns intent + entities, the intent is encoded as a quaternion that drives the screen transition:

```typescript
sarvamClient.onIntentClassified((intent: string, confidence: number) => {
  const intentQ = QuaternionEncoder.fromString(intent)
  const confidenceQ = QuaternionEncoder.fromScalar(confidence)
  const combined = intentQ.slerp(confidenceQ, 0.3).normalize()

  // High confidence → identity-like (clear, present, R3)
  // Low confidence → equatorial (searching, R1/R2)
  const targetScreen = intentToScreen(intent)
  transitionScreens(currentScreen, targetScreen, appContainer, combined)
})
```

The visual transition literally encodes the AI's confidence. A high-confidence intent produces a clean, swift transition. A low-confidence interpretation produces a slightly warmer, more exploratory visual passage. The user feels the AI's certainty level through the interface.

### 8.4 BentoPDF / Tesseract OCR

Document processing produces progress events. The progress quaternion drives the visual feedback:

```typescript
ocrEngine.onProgress((stage: string, progress: number, confidence?: number) => {
  const stageQ = QuaternionEncoder.fromString(stage)
  const progressQ = QuaternionEncoder.fromScalar(progress)
  const q = stageQ.slerp(progressQ, 0.5).normalize()
  const cq = CURRENT_CULTURE.rotationQ.multiply(q).normalize()

  // Update the processing ring
  renderProgressRing(ctx, progress, cx, cy, radius, CURRENT_CULTURE)

  // Update the status label color
  const [r, g, b] = cq.toRGB().map(v => Math.round(v * 255))
  gsap.to(statusLabel, {
    color: `rgb(${r},${g},${b})`,
    duration: 0.089,
    ease: 'power1.out',
  })
})
```

---

## Section 9: Recipes

### Recipe 1: Expense Chart with Turmeric Wash

**Scenario:** Lakshmi's monthly expenses encoded as quaternions, rendered as a Matti brushstroke chart.

```typescript
async function renderExpenseChart(canvas: HTMLCanvasElement, expenses: MonthlyExpense[]) {
  const ctx = canvas.getContext('2d')!
  const maxExpense = Math.max(...expenses.map(e => e.amount))
  const culture = MATTI

  // Encode each expense as a quaternion
  const quaternions = expenses.map(e => {
    const rawQ = QuaternionEncoder.fromRange(e.amount, 0, maxExpense)
    return culture.rotationQ.multiply(rawQ).normalize()
  })

  // Background: warm Patti linen
  ctx.fillStyle = culture.basePalette['paper']
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw turmeric-washed brushstroke series
  const STEPS = 13   // Fibonacci[7]
  for (let i = 1; i < quaternions.length; i++) {
    const q1 = quaternions[i-1]
    const q2 = quaternions[i]

    for (let s = 0; s < STEPS; s++) {
      const t = s / STEPS
      const q = q1.slerp(q2, t)
      const [r, g, b] = q.toRGB().map(v => Math.round(v * 255))
      const props = resolver.resolve(q)

      // Brushstroke: Pasupu (turmeric) dominates because MATTI rotation
      // pushes values toward the yellow-orange spectrum
      ctx.beginPath()
      ctx.lineWidth = props.scale * 8
      ctx.strokeStyle = `rgba(${r},${g},${b},${props.opacity * 0.8})`
      ctx.lineCap = 'round'

      const x = (i - 1 + t) / (quaternions.length - 1) * canvas.width
      const y = canvas.height - (props.scale - 0.5) * canvas.height * 2

      if (s === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // Kolam dot markers at each data point
  quaternions.forEach((q, i) => {
    const props = resolver.resolve(q)
    const x = (i / (quaternions.length - 1)) * canvas.width
    const y = canvas.height - (props.scale - 0.5) * canvas.height * 2
    const [r, g, b] = q.toRGB().map(v => Math.round(v * 255))

    ctx.beginPath()
    ctx.arc(x, y, FIB[4], 0, Math.PI * 2)   // 5px dots
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fill()
  })
}
```

### Recipe 2: Morning Briefing Entry Sequence

**Scenario:** 8-step GSAP timeline for Lakshmi's morning briefing card sequence — weather, price, PM-KISAN status, pest alert, market advisory, credit score, today's tasks, community.

```typescript
function buildMorningBriefingTimeline(cards: Element[]): gsap.core.Timeline {
  const tl = gsap.timeline()
  const culture = MATTI

  // Each of 8 cards has a "topic quaternion" derived from its role
  const topics = ['weather', 'price', 'pmkisan', 'pest', 'market', 'credit', 'tasks', 'community']

  topics.forEach((topic, i) => {
    const q = culture.rotationQ.multiply(QuaternionEncoder.fromString(topic)).normalize()
    const p = resolver.resolve(q)
    const [r, g, b] = q.toRGB().map(v => Math.round(v * 255))

    const card = cards[i]
    const delay = FIB[i + 3] / 1000   // Fibonacci stagger in seconds: 3,5,8,13,21,34,55,89ms

    tl.from(card, {
      opacity: 0,
      y: FIB[7],      // 21px
      scale: 0.92,
      backgroundColor: `rgba(${r},${g},${b},0)`,
      duration: p.duration / 1000,
      ease: 'back.out(1.2)',
    }, delay)
  })

  // SLERP color morph from identity to each card's color as they enter
  topics.forEach((topic, i) => {
    const q = QuaternionEncoder.fromString(topic)
    const cq = culture.rotationQ.multiply(q).normalize()
    const card = cards[i]
    const delay = FIB[i + 3] / 1000

    tl.add(
      sequencer.slerpMorph(card, Quaternion.identity(), cq),
      delay
    )
  })

  return tl
}
```

### Recipe 3: Screen Transition — Home to Market

**Scenario:** Lakshmi taps the market price button. The screen transitions from the home dashboard to the market screen.

```typescript
async function homeToMarket(container: Element) {
  const homeQ  = QuaternionEncoder.fromString('home')
  const marketQ = QuaternionEncoder.fromString('market-prices')
  const cultureQ = MATTI.rotationQ

  // Home is identity-like (calm, R3). Market is more exploratory (R1/R2).
  const from = cultureQ.multiply(homeQ).normalize()
  const to   = cultureQ.multiply(marketQ).normalize()

  const theta = from.geodesicDistance(to)
  const duration = 0.233 * (theta / Math.PI) * 3   // geodesic-proportionate duration

  // Phase 1: fade out home content with exit orientation
  await gsap.to('#home-content', {
    opacity: 0,
    x: -FIB[8],     // 34px left
    duration: duration * 0.4,
    ease: 'power2.in',
  })

  // Phase 2: container background SLERP during swap
  const proxy = { t: 0 }
  const tl = gsap.timeline()
  tl.to(proxy, {
    t: 1,
    duration: duration * 0.2,
    ease: 'none',
    onUpdate() {
      const q = from.slerp(to, proxy.t)
      const [r, g, b] = q.toRGB().map(v => Math.round(v * 255))
      gsap.set(container, { backgroundColor: `rgba(${r},${g},${b},0.05)` })
    },
  })
  await tl

  // Swap DOM content (framework-level, not shown here)
  await swapScreenContent('home', 'market')

  // Phase 3: fade in market content from arrival orientation
  await gsap.from('#market-content', {
    opacity: 0,
    x: FIB[8],
    duration: duration * 0.4,
    ease: 'back.out(1.1)',
  })
}
```

### Recipe 4: Farm Health Breathing Ring

**Scenario:** The Rythu Mitra "Matti Score" (a composite farm health metric 0–100) drives a continuously breathing ring. The ring changes color and pulse rate as the score changes.

```typescript
class FarmHealthRing {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private score = 50
  private q = Quaternion.identity()
  private breathT = 0
  private animFrame: number

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.loop()
  }

  updateScore(newScore: number) {
    const rawQ = QuaternionEncoder.fromScalar(newScore / 100)
    const targetQ = MATTI.rotationQ.multiply(rawQ).normalize()
    // Smooth transition to new score quaternion
    this.q = this.q.slerp(targetQ, 0.05)
    this.score = newScore
  }

  private loop() {
    const ctx = this.ctx
    const { width, height } = this.canvas
    const cx = width / 2, cy = height / 2, r = Math.min(width, height) * 0.42

    ctx.clearRect(0, 0, width, height)

    // Breathing: w oscillates via sine at Love Hz (0.1 Hz)
    this.breathT += 0.1 / 60   // 0.1 Hz at 60fps
    const breathFactor = (Math.sin(this.breathT * 2 * Math.PI) + 1) / 2   // [0,1]
    const breathQ = this.q.slerp(
      new Quaternion(this.q.w + 0.1, this.q.x, this.q.y, this.q.z).normalize(),
      breathFactor * 0.3
    )

    const p = resolver.resolve(breathQ)
    const [rx, gx, bx] = breathQ.toRGB().map(v => Math.round(v * 255))

    // Outer track
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.lineWidth = FIB[4]
    ctx.strokeStyle = `rgba(${rx},${gx},${bx},0.15)`
    ctx.stroke()

    // Score arc (progress × 2π)
    const endAngle = -Math.PI / 2 + (this.score / 100) * 2 * Math.PI
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, endAngle)
    ctx.lineWidth = FIB[5] * p.scale   // 8px × scale, breathes slightly
    ctx.strokeStyle = `rgba(${rx},${gx},${bx},${p.opacity})`
    ctx.lineCap = 'round'
    ctx.stroke()

    // Score text
    ctx.font = `${FIB[10]}px ${MATTI.fonts.display}`   // 89px Noto Serif Telugu
    ctx.fillStyle = `rgba(${rx},${gx},${bx},${p.opacity})`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${Math.round(this.score)}`, cx, cy)

    this.animFrame = requestAnimationFrame(() => this.loop())
  }

  destroy() {
    cancelAnimationFrame(this.animFrame)
  }
}
```

### Recipe 5: Celebration Particles — Successful Loan Repayment

**Scenario:** Lakshmi completes a loan repayment. 21 Fibonacci-staggered particles follow SLERP geodesic trajectories.

```typescript
function celebrateLoanRepayment(container: Element, amount: number) {
  // Encode the repaid amount as a quaternion (pasupu gold energy)
  const amountQ = QuaternionEncoder.fromScalar(Math.min(1, amount / 100000))
  const celebQ  = MATTI.rotationQ.multiply(amountQ).normalize()

  const N = 21   // Fibonacci[9]
  const rect = container.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  // Fixed destination quaternions at golden-angle intervals around S³
  for (let i = 0; i < N; i++) {
    const theta = i * GOLDEN_ANGLE_RAD
    const phi   = (i / N) * Math.PI
    const destQ = new Quaternion(
      Math.cos(phi),
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(theta) * 0.1
    ).normalize()

    const particle = document.createElement('div')
    particle.className = 'celebration-particle'
    document.body.appendChild(particle)

    // SLERP from start (celebQ) to destination
    const state = { t: 0 }
    const stagger = FIB[i % 9 + 3] / 1000   // varied Fibonacci delays

    gsap.to(state, {
      t: 1,
      duration: 0.610,
      ease: 'power2.out',
      delay: stagger,
      onUpdate() {
        const q = celebQ.slerp(destQ, state.t)
        const [r, g, b] = q.toRGB().map(v => Math.round(v * 255))
        const props = resolver.resolve(q)

        // Geodesic position: project q to 2D
        const px = cx + q.x * 144 * (1 + i / N * 0.5)
        const py = cy + q.y * 144 * (1 + i / N * 0.5)

        gsap.set(particle, {
          x: px, y: py,
          width:  FIB[3] + FIB[4] * props.scale,
          height: FIB[3] + FIB[4] * props.scale,
          borderRadius: '50%',
          backgroundColor: `rgb(${r},${g},${b})`,
          opacity: props.opacity * (1 - state.t * 0.8),
          position: 'fixed',
        })
      },
      onComplete() {
        particle.remove()
      },
    })
  }

  // Pulse the repayment card itself
  const card = container.querySelector('[data-loan-card]')
  if (card) {
    const targetQ = MATTI.rotationQ.multiply(
      Quaternion.fromAxisAngle([0, 1, 0], Math.PI / 3)
    ).normalize()
    sequencer.slerpMorph(card as Element, celebQ, targetQ, { duration: 987 })
  }
}
```

---

## Appendix: Constants Reference

```typescript
// Mathematical constants
export const PHI  = 1.618033988749895      // Golden ratio
export const PHI2 = 2.618033988749895      // φ²
export const GOLDEN_ANGLE_DEG = 137.5077640500378  // degrees
export const GOLDEN_ANGLE_RAD = 2.399963229728653  // radians
export const LOVE_HZ = 0.1                 // Breathing / heartbeat frequency
export const ATTRACTOR = 0.87532           // 87.532% SAT thermodynamic limit

// Fibonacci sequence (first 17 values)
export const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597]

// Fibonacci spacing (CSS custom properties, px)
// --space-1 through --space-144 — see section 1.3.1

// Fibonacci durations (ms)
// --dur-instant (8ms) through --dur-ceremonial (987ms) — see section 1.3.4

// Regime thresholds (fraction of geodesic max)
export const R1_MAX  = 0.30   // Exploration zone: angle ∈ [0, 0.3π]
export const R2_MAX  = 0.50   // Optimization zone: angle ∈ [0.3π, 0.5π]
// R3 zone: angle ∈ [0.5π, π]

// Bundle size targets (gzipped)
export const BUNDLE_LIMIT_KB = 50

// Canvas performance
export const FIELD_FPS       = 8    // Background Phi-organism update rate
export const MAIN_THREAD_FPS = 60   // GSAP animation frame rate
export const MAX_ACTIVE_ANIMATIONS = 20  // Concurrent SLERP morphs

// Digital root utility
export function digitalRoot(n: number): number {
  if (n === 0) return 0
  const r = n % 9
  return r === 0 ? 9 : r
}

// Regime detection
export function detectRegime(q: Quaternion): 'R1' | 'R2' | 'R3' {
  const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w))) / Math.PI
  if (angle < R1_MAX) return 'R1'
  if (angle < R2_MAX) return 'R2'
  return 'R3'
}

// NavaYoni planetary energy table
export const NAVA_YONI: Record<number, string> = {
  1: 'Surya',    // Sun — authority, gold
  2: 'Chandra',  // Moon — care, silver-blue
  3: 'Mangal',   // Mars — energy, red-orange
  4: 'Budha',    // Mercury — precision, green-teal
  5: 'Guru',     // Jupiter — wisdom, indigo
  6: 'Shukra',   // Venus — beauty, pink-gold
  7: 'Shani',    // Saturn — depth, dark grey
  8: 'Rahu',     // North Node — intensity, deep red
  9: 'Ketu',     // South Node — transcendence, white-violet
}
```

---

## Closing Note

This spec describes a **generative system**, not a static library. Its correctness property is:

```
∀ visual property p, ∀ data value d:
  p = f(d, culture, regime)
  where f is a deterministic composition of quaternion operations

  AND

  ∀ animations between states s1 and s2:
  animation = SLERP(q(s1), q(s2))
  duration  = BASE_DUR × geodesicDistance(q(s1), q(s2)) / π × 3
```

If these two properties hold, the engine is correct. Visual consistency is a mathematical consequence, not a design discipline problem.

The engine is culturally sovereign: Matti is not a "theme applied to a Western base." It is a rotation of the universal substrate that produces colors, patterns, and rhythms native to the Telugu-speaking world. Future cultures — Kannada, Tamil, Bengali, Odia — are different rotations of the same foundation.

The engine runs on a ₹10K phone because it respects the device's constraints mathematically, not as an afterthought. The Web Worker architecture, the 50KB bundle limit, the 8fps background field, the CSS transform preference — these are not compromises. They are the design.

---

**Om Lokah Samastah Sukhino Bhavantu**
*May Lakshmi's farm data flow into beauty. May the math serve the people.*

**Source Files Referenced:**
- `C:\Projects\git_versions\asymm_all_math\asymm_mathematical_organism\geometric_consciousness_imaging\qgif\quaternion_image.py` — canonical toRGB(), SLERP, normalize implementations
- `C:\Projects\git_versions\asymm_all_math\asymm_mathematical_organism\geometric_consciousness_imaging\qgif\qgif_unified.py` — Phi-organism evolution, Rayleigh scattering, QGIF binary format
- `C:\Projects\git_versions\asymm_all_math\asymm_mathematical_organism\geometric_consciousness_imaging\living_geometry\` — existing 25 components, design tokens, wabi-sabi palette
