# Comic Book Puzzle Website - Design System

## Color Palette

### Primary Colors (Heroic Comic Style)
- **Bright Blue**: #0052CC
  - Usage: CTA buttons, links, primary accents
  - Conveys action and trust
  
- **Intense Red**: #DC143C
  - Usage: clues, alerts, important elements
  - Draws attention and emphasizes urgency
  
- **Golden Yellow**: #FFD700
  - Usage: badges, achievements, victory elements
  - Celebrates success and completion

### Secondary Colors (Dynamic Accents)
- **Warm Orange**: #FF8C00
  - Usage: secondary CTAs, hover states
  - Provides energy and warmth

- **Mysterious Purple**: #6B46C1
  - Usage: locked puzzles, bonus sections
  - Creates visual distinction for restricted content

### Neutral Colors (Readability & Structure)
- **Deep Black**: #1A1A1A
  - Usage: primary text, comic panel borders
  - Maximum contrast for legibility

- **Light Gray**: #F5F5F5
  - Usage: section backgrounds, breathing room
  - Reduces visual fatigue

- **Pure White**: #FFFFFF
  - Usage: main background, dialog bubbles
  - Clean foundation for all content

---

## Typography

### Headlines & Titles
**Font**: Bangers (Google Fonts)
- Usage: h1, h2, main puzzle titles, section headings
- Purpose: Creates impactful "POW!" comic aesthetic
- Size: 32px–48px for main titles, 24px–32px for sections

### Body Text & Instructions
**Font**: Poppins or Inter (Google Fonts)
- Usage: puzzle descriptions, instructions, general content
- Purpose: Maximum readability while maintaining playful tone
- Size: 14px–16px for body, 18px–20px for descriptions
- Weight: Regular (400) for body, Semi-bold (600) for emphasis
- **Recommendation**: Poppins for warmer, rounder feel; Inter for cleaner approach

### Clues & Secondary Text
**Font**: Comic Neue (Google Fonts)
- Usage: hints, comments, asides, italicized text
- Purpose: Visual distinction without overwhelming the page
- Size: 12px–14px
- Weight: Regular (400), Italic (400i) for emphasis

---

## Visual Style & Illustrations

### Graphic Palette
- **Line Weight**: Thick, clean outlines (2–3px) mimicking traditional Franco-Belgian comics
- **Color Treatment**: Flat colors without gradients (exception: subtle shadows)
- **Effects**: Optional halftone/dot patterns for authentic comic book texture
- **Dialog Bubbles**: Classic rounded rectangles with pointed tails

### Required Illustrations
- **Mascot Character**: Detective, inspector, or recurring character for tutorials and hints
- **Status Icons**: Comic-style icons for puzzle states (solved/locked/in-progress)
- **Panel Sections**: Comic-style vignettes framing puzzle groups
- **Sound Effects**: Textured, stylized effects (ZAP!, PING!, CLAC!) for user feedback
- **Achievement Badges**: Comic-style medals and victory markers

### Illustration Style
- Hand-drawn quality or digital illustration mimicking hand-drawn
- Bold, expressive line art
- No photorealism; maintain graphic novel aesthetic
- Consider hiring a comic book illustrator for custom assets

---

## Components & Layout

### Puzzle Cards
- **Border**: Thick black outline (3px) or primary color
- **Shadow**: Subtle drop shadow for depth
- **Header**: Large puzzle number + difficulty badge (Easy/Medium/Hard)
- **Background Tint**: Color-coded by difficulty
  - Easy: Light blue tint
  - Medium: Light orange tint
  - Hard: Light red tint
- **Content**: Puzzle title, description, clue indicator
- **Footer**: Status indicator and interaction prompt

### Dialog Bubbles & Hints
- **Style**: Classic comic bubbles with thick outline
- **Border**: Black outline (2–3px)
- **Background**: White or very light color
- **Text**: Dark gray (#333333) or black (#1A1A1A)
- **Tail**: Pointed speech bubble tail indicating source

### Call-to-Action Buttons
- **Border**: Thick outline (3–4px) in primary color
- **Text Color**: White on colored background
- **No soft shadows**: Keep edges crisp and bold
- **Hover Animation**: Slight rotation or subtle shake effect
- **Active State**: Darker shade of primary color
- **Text**: Bangers font for maximum impact
- **Padding**: Generous (16px–20px vertical, 24px–32px horizontal)

### Progress & Statistics
- **Health/Progress Bars**: Retro gaming style with bold outline
- **Counters**: Large, bold numbers with thick outlines
- **Badges**: Gold (#FFD700) for achievements with checkmark icon
- **Level Indicators**: Comic-style numbered boxes

---

## Puzzle State System

### Visual States by Puzzle Status

| State | Primary Color | Secondary Element | Icon/Badge | Text Effect |
|-------|--------------|-------------------|-----------|------------|
| **Locked** | Purple (#6B46C1) | Padlock icon | 🔒 | Grayed-out text |
| **Available** | Blue (#0052CC) | Question mark | ❓ | Normal text |
| **In Progress** | Orange (#FF8C00) | Clock/timer | ⏱️ | Slightly bold |
| **Solved** | Golden Yellow (#FFD700) | Checkmark | ✓ | Bold, celebratory |

### Hover/Interaction States
- **Unlock Visual Effect**: Slight glow or border animation
- **Button Hover**: Color darkens by 10–15%, border may shimmer
- **Card Hover**: Subtle lift effect (transform: translateY(-4px))

---

## User Feedback Animations

### Correct Answer
- **Animation**: Fade-in golden yellow highlight
- **Effect Text**: "BRAVO!" or "EXCELLENT!" in Bangers font (24–32px)
- **Sound**: Optional success sound effect
- **Duration**: 1–2 seconds

### Incorrect Answer
- **Animation**: Red shake or blink effect
- **Effect Text**: "OOPS!" or "TRY AGAIN!" in Bangers font
- **Color Flash**: Brief red (#DC143C) overlay
- **Duration**: 0.5–1 second

### Time Expired
- **Animation**: Grayscale fade or gray overlay
- **Effect Text**: "TIME'S UP!" in Bangers font
- **Sound**: Optional countdown or buzzer sound

---

## Layout Grid & Spacing

### Spacing Scale
- **xs**: 4px (micro-spacing)
- **sm**: 8px (compact spacing)
- **md**: 16px (standard spacing)
- **lg**: 24px (section spacing)
- **xl**: 32px (major sections)
- **2xl**: 48px (page margins)

### Grid System
- **Desktop**: 12-column grid, 1200px max-width
- **Tablet**: 8-column grid, 768px width
- **Mobile**: 4-column grid, full width minus safe area

### Responsive Breakpoints
- **Mobile**: 320px–640px
- **Tablet**: 641px–1024px
- **Desktop**: 1025px and above

---

## Tone & Overall Visual Philosophy

The website should feel **dynamic, playful, and accessible**. Think Tintin or Astérix rather than manga—timeless Franco-Belgian comic aesthetic. Thick outlines and vibrant colors define the style more than special effects.

### Visual Principles
1. **Bold**: Use thick lines and solid colors
2. **Clear**: Maximum readability despite playful theme
3. **Energetic**: Colors and typography convey action
4. **Accessible**: High contrast, large text, clear hierarchy
5. **Consistent**: Unified comic book visual language throughout

---

## Implementation Notes for Developers

### CSS Variables (Suggested)
```css
:root {
  --color-primary-blue: #0052CC;
  --color-primary-red: #DC143C;
  --color-primary-yellow: #FFD700;
  --color-secondary-orange: #FF8C00;
  --color-secondary-purple: #6B46C1;
  --color-neutral-black: #1A1A1A;
  --color-neutral-gray: #F5F5F5;
  --color-neutral-white: #FFFFFF;
  
  --font-display: 'Bangers', sans-serif;
  --font-body: 'Poppins', sans-serif;
  --font-secondary: 'Comic Neue', sans-serif;
  
  --border-width-thin: 2px;
  --border-width-medium: 3px;
  --border-width-thick: 4px;
  --border-style: solid;
  --border-color: var(--color-neutral-black);
  
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
}
```

### Google Fonts Import
```html
<link href="https://fonts.googleapis.com/css2?family=Bangers&family=Poppins:wght@400;600&family=Comic+Neue:ital@0;1&display=swap" rel="stylesheet">
```

### Button Base Style Example
```css
.btn {
  border: var(--border-width-thick) var(--border-style) var(--color-primary-blue);
  background-color: var(--color-primary-blue);
  color: var(--color-neutral-white);
  font-family: var(--font-display);
  padding: var(--spacing-lg) var(--spacing-xl);
  border-radius: 8px;
  transition: transform 0.2s ease, filter 0.2s ease;
}

.btn:hover {
  transform: translateY(-2px);
  filter: brightness(0.9);
}
```

### Card Base Style Example
```css
.puzzle-card {
  border: var(--border-width-medium) var(--border-style) var(--color-neutral-black);
  background-color: var(--color-neutral-white);
  border-radius: 12px;
  padding: var(--spacing-lg);
  box-shadow: 4px 4px 0px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.puzzle-card:hover {
  transform: translateY(-4px);
  box-shadow: 6px 6px 0px rgba(0, 0, 0, 0.15);
}
```

---

## Asset Checklist

- [ ] Download & implement Bangers, Poppins, Comic Neue from Google Fonts
- [ ] Create or commission comic book illustration style assets
- [ ] Design mascot character for guidance & hints
- [ ] Create status icons (locked, unlocked, solved, in-progress)
- [ ] Design achievement badges
- [ ] Create sound effect graphics (ZAP!, PING!, etc.)
- [ ] Build component library with all states
- [ ] Test color contrast for accessibility (WCAG AA minimum)
- [ ] Validate responsive behavior across breakpoints
- [ ] Create animation specifications for feedback states

---

## References & Inspiration

- **Visual Style**: Tintin, Astérix, modern Franco-Belgian comics
- **Color Theory**: High contrast, primary colors for primary actions
- **Typography**: Comic Sans alternatives (Comic Neue, Bangers)
- **Design Systems**: Material Design (structure), but with comic twist