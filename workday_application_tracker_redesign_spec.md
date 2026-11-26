# Workday Application Tracker --- Complete UI Redesign Specification

## AI-Agent Implementation Brief

### Role

Act as a **Senior Product Designer + Senior Full-Stack Engineer**.

You are redesigning an existing **Workday Application Tracker SaaS
dashboard**. The current application is functional, but its visual
design looks generic and AI-generated.

Your task is to **completely redesign the frontend visual system and
dashboard experience** while preserving the existing business logic, API
integrations, authentication, data flow, and functionality unless a
UI/UX change explicitly requires a small frontend adaptation.

Do not make the result look like a generic AI dashboard.

The finished application should feel like a real product designed by an
experienced product team for people actively managing job applications.

------------------------------------------------------------------------

# 1. PRIMARY OBJECTIVE

Transform the current UI from:

-   dark purple/indigo AI-dashboard aesthetic
-   excessive rounded cards
-   emoji-based icons
-   glowing/gradient styling
-   six visually identical metric cards
-   excessive visual decoration
-   generic SaaS typography
-   card-heavy layout
-   low-contrast secondary information

into:

-   calm
-   premium
-   trustworthy
-   editorial
-   operational
-   information-dense but readable
-   product-specific
-   human-curated
-   responsive
-   accessible

The interface must communicate:

> "This is a serious application-management tool."

It must NOT communicate:

> "This was generated from an AI SaaS dashboard template."

------------------------------------------------------------------------

# 2. IMPORTANT IMPLEMENTATION RULES

## Preserve functionality

Do NOT unnecessarily rewrite:

-   API calls
-   authentication
-   database logic
-   routing
-   application state
-   backend services
-   WebWorkday integration
-   notification logic
-   application tracking logic

The redesign is primarily a **frontend visual and UX transformation**.

If existing components already contain correct functionality, refactor
their presentation rather than replacing their business logic.

------------------------------------------------------------------------

# 3. CURRENT DESIGN PROBLEMS

The existing dashboard currently has:

-   dark almost-black background
-   purple/indigo primary color
-   six identical metric cards
-   emoji/icons inside metrics
-   large rounded cards
-   decorative colored circles inside metric cards
-   bright purple metric values
-   multiple neon-like chart colors
-   muted secondary text
-   large sidebar
-   excessive card enclosure
-   generic SaaS typography
-   chart with multiple colored series
-   activity feed contained inside a large card

These characteristics collectively create an AI-generated dashboard
appearance.

------------------------------------------------------------------------

# 4. REDESIGN DIRECTION

## Selected Direction

Use:

# Editorial Operations

Visual references in terms of principles:

-   modern productivity software
-   professional operations dashboards
-   editorial information design
-   premium developer/productivity tools
-   restrained enterprise SaaS

Do NOT directly copy another company's design.

The goal is to establish an original visual identity.

------------------------------------------------------------------------

# 5. DESIGN PERSONALITY

The application should feel:

-   precise
-   calm
-   trustworthy
-   mature
-   technical
-   editorial
-   efficient
-   slightly understated
-   human
-   intentional

Avoid:

-   futuristic
-   cyberpunk
-   neon
-   excessive gradients
-   excessive glassmorphism
-   glowing UI
-   giant rounded cards
-   excessive animation
-   AI robots
-   decorative 3D objects
-   excessive emoji
-   generic "AI-powered" visual language

------------------------------------------------------------------------

# 6. COLOR SYSTEM

## Light Theme

Use the following palette.

### Background

``` css
--surface-page: #F6F7F5;
--surface-primary: #FFFFFF;
--surface-secondary: #EEF1EF;
--surface-tertiary: #E7EBE9;
```

### Text

``` css
--text-primary: #17201F;
--text-secondary: #4D5A57;
--text-muted: #74807C;
--text-disabled: #A5AEAA;
```

### Borders

``` css
--border-subtle: #E8ECEA;
--border-default: #DDE3E0;
--border-strong: #CBD4D0;
```

### Primary Brand

``` css
--primary-900: #163A3D;
--primary-800: #1D4B4D;
--primary-700: #276568;
--primary-600: #347A7B;
--primary-500: #4C9290;
--primary-100: #DCEDEC;
--primary-50: #F1F7F6;
```

Primary UI color:

``` css
--color-primary: #276568;
```

Hover:

``` css
--color-primary-hover: #1D4B4D;
```

Active:

``` css
--color-primary-active: #163A3D;
```

### Accent

Use sparingly.

``` css
--accent: #C8754D;
--accent-hover: #A95D3A;
--accent-soft: #F5E4DC;
```

Do NOT use the accent for every button or card.

------------------------------------------------------------------------

# 7. SEMANTIC COLORS

## Success

``` css
--success: #2E8059;
--success-soft: #DDF1E6;
```

## Warning

``` css
--warning: #A97018;
--warning-soft: #F8EBCF;
```

## Error

``` css
--error: #B84A42;
--error-soft: #F7DEDC;
```

## Information

``` css
--info: #327595;
--info-soft: #DDEDF5;
```

------------------------------------------------------------------------

# 8. COLOR USAGE RULES

Do NOT make the entire UI colorful.

The default interface should be approximately:

``` text
85–90% neutral
10–15% semantic/brand color
```

Use color to communicate:

-   state
-   interaction
-   important changes
-   active navigation
-   warnings
-   success
-   errors

Do not use color simply to decorate empty space.

------------------------------------------------------------------------

# 9. DARK MODE

If the application currently supports dark mode, redesign it rather than
removing it.

Use:

``` css
--dark-page: #121817;
--dark-surface: #19201F;
--dark-surface-raised: #202827;

--dark-text-primary: #EEF2F0;
--dark-text-secondary: #B8C1BE;
--dark-text-muted: #87918E;

--dark-border: #303A38;

--dark-primary: #72B8B5;
--dark-primary-hover: #8AC7C4;

--dark-accent: #D28A68;
```

Do NOT simply invert the light theme.

Do NOT use pure black `#000000` for the entire page.

Do NOT use pure white `#FFFFFF` for every piece of text.

------------------------------------------------------------------------

# 10. ACCESSIBILITY

Target WCAG AA.

Minimum contrast:

-   normal text: 4.5:1
-   large text: 3:1
-   UI controls: 3:1
-   focus indicators: 3:1

Important text should ideally approach 7:1 where practical.

Do not use low-contrast gray text for important information.

------------------------------------------------------------------------

# 11. TYPOGRAPHY

## Primary UI Typeface

Use:

**Instrument Sans**

Load it properly through the existing project's preferred font-loading
mechanism.

Fallback:

``` css
font-family:
  "Instrument Sans",
  system-ui,
  sans-serif;
```

## Technical Typeface

Use:

**IBM Plex Mono**

For:

-   application IDs
-   dates when appropriate
-   numerical metrics when useful
-   technical metadata
-   keyboard shortcuts

## Optional Editorial Typeface

Use:

**Source Serif 4**

Only for occasional editorial emphasis.

Do NOT use it throughout the application.

------------------------------------------------------------------------

# 12. TYPOGRAPHY SCALE

## Display

``` css
font-size: 40px;
line-height: 1.08;
font-weight: 650;
letter-spacing: -0.035em;
```

## H1

``` css
font-size: 32px;
line-height: 1.15;
font-weight: 650;
letter-spacing: -0.025em;
```

## H2

``` css
font-size: 24px;
line-height: 1.25;
font-weight: 620;
letter-spacing: -0.018em;
```

## H3

``` css
font-size: 18px;
line-height: 1.35;
font-weight: 600;
```

## Body

``` css
font-size: 15px;
line-height: 1.55;
font-weight: 400;
```

## Small

``` css
font-size: 13px;
line-height: 1.45;
font-weight: 400;
```

## Caption

``` css
font-size: 12px;
line-height: 1.4;
font-weight: 500;
```

## Labels

``` css
font-size: 12px;
line-height: 1.35;
font-weight: 600;
letter-spacing: 0.015em;
```

Do not use uppercase labels excessively.

------------------------------------------------------------------------

# 13. NUMBER TYPOGRAPHY

Use:

``` css
font-variant-numeric: tabular-nums;
```

For primary dashboard metrics:

``` css
font-size: 28px;
font-weight: 620;
letter-spacing: -0.025em;
```

Do not make every number enormous.

Numbers should be prominent because they are important, not because the
template expects large numbers.

------------------------------------------------------------------------

# 14. SPACING SYSTEM

Use:

``` css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 32px;
--space-8: 40px;
--space-9: 48px;
--space-10: 64px;
--space-11: 80px;
```

Use these as a base system.

However, do NOT force every element to have identical spacing.

Spacing should communicate relationships.

Example:

``` text
Page title
    8px
Description
    28px
Primary metrics
    36px
Chart
    32px
Recent activity
```

------------------------------------------------------------------------

# 15. GRID

Desktop:

``` css
max-width: 1440px;
margin: 0 auto;
padding-inline: 32px;
column-gap: 20px;
```

Use a 12-column grid conceptually.

At \<= 1024px:

``` css
padding-inline: 24px;
```

At \<= 640px:

``` css
padding-inline: 16px;
```

------------------------------------------------------------------------

# 16. BORDER RADIUS

Do NOT use 20px--24px radius everywhere.

Use:

``` css
--radius-control: 7px;
--radius-card: 10px;
--radius-dialog: 12px;
--radius-pill: 999px;
```

Components:

  Component     Radius
  ----------- --------
  Buttons          7px
  Inputs           7px
  Cards           10px
  Dialogs         12px
  Badges         999px
  Avatar           50%
  Tooltip          6px

------------------------------------------------------------------------

# 17. SHADOWS

Use shadows sparingly.

``` css
--shadow-subtle:
  0 1px 2px rgba(23, 32, 31, 0.04);

--shadow-card:
  0 4px 14px rgba(23, 32, 31, 0.06);

--shadow-floating:
  0 12px 32px rgba(23, 32, 31, 0.10);
```

Use borders more frequently than shadows.

Cards should generally have:

``` css
border: 1px solid var(--border-default);
```

Do not put a strong shadow on every card.

------------------------------------------------------------------------

# 18. SIDEBAR REDESIGN

Current sidebar is too visually heavy.

Target width:

``` text
220px–232px
```

Suggested structure:

``` text
Workday
Application Tracker

WORKSPACE

Overview
Applications
Notifications       22

SYSTEM

Settings
```

Remove emoji.

Use a consistent icon library such as Lucide.

Recommended icon size:

``` text
18px
```

Stroke:

``` text
1.75
```

Selected navigation should use:

``` css
background: #F1F7F6;
color: #276568;
```

or the corresponding dark theme treatment.

Do not use a large glowing purple selected state.

------------------------------------------------------------------------

# 19. HEADER REDESIGN

Replace:

``` text
Dashboard
Your job application overview
```

with:

``` text
Overview

Your application pipeline at a glance.

39 applications · 5 added this week
```

Right side:

``` text
[ + Add application ]
```

Optionally:

``` text
[ Search ⌘K ]
```

The primary dashboard CTA should be an action, not merely a link to
another page.

------------------------------------------------------------------------

# 20. RESTRUCTURE THE METRIC AREA

The current six equal metric cards must be replaced.

Do NOT use:

``` text
Total Applications
Active Pipeline
Interviews
Offers
Response Rate
Rejections
```

as six equally sized cards.

Instead create hierarchy.

## Primary metrics

``` text
39
APPLICATIONS

+5 this week
```

and:

``` text
34
ACTIVE PIPELINE

7 awaiting response
```

These should receive the most visual attention.

## Secondary pipeline metrics

Show:

``` text
Interviews       0
Offers           0
Rejected         4
```

## Analytical metric

Show:

``` text
Response rate

10%

4 responses from 39 applications
```

This gives the user a much clearer understanding of their search.

------------------------------------------------------------------------

# 21. PIPELINE COMPONENT

Add a dedicated pipeline summary.

Example:

``` text
APPLICATION PIPELINE

Applied              34
Screening             8
Interview              0
Offer                  0
Rejected               4
```

Or visually:

``` text
Applied
   34
   │
   ▼
Screening
    8
   │
   ▼
Interview
    0
   │
   ▼
Offer
    0
```

Keep the visual treatment restrained.

Do not use giant colored blocks.

------------------------------------------------------------------------

# 22. STATUS COLORS

Use semantic status colors:

``` text
Applied       #4D6F73
Screening     #A27632
Interview     #327595
Offer         #2E8059
Rejected      #A84A43
```

Prefer small status dots:

``` text
● Applied
● Screening
● Interview
● Offer
● Rejected
```

rather than large colored pills everywhere.

------------------------------------------------------------------------

# 23. CHART REDESIGN

The current chart contains too many visual elements.

Do NOT default to four bright lines:

-   Applied
-   Interviews
-   Offers
-   Rejections

Instead default to:

**Applications submitted over time**

Use:

-   one primary line
-   subtle grid
-   neutral axis
-   direct labels where useful
-   restrained animation

Provide filters/toggles:

``` text
[ Applications ] [ Interviews ] [ Offers ]
```

The default chart should answer:

> "How active has my application search been?"

Do not make the chart look like a trading terminal.

------------------------------------------------------------------------

# 24. CHART COLORS

Use the primary brand color for the main series:

``` text
#276568
```

Comparison series:

``` text
#87918E
```

Semantic event markers can use:

``` text
Success #2E8059
Warning #A97018
Error #B84A42
```

Avoid neon chart colors.

------------------------------------------------------------------------

# 25. RECENT ACTIVITY REDESIGN

Current structure is good but too card-heavy.

Convert it into a timeline/list.

Example:

``` text
RECENT ACTIVITY

Today

10:42
● Status updated
  Accenture
  Custom Software Engineer
  50 minutes ago

09:18
● Assessment received
  IQVIA Global
  Intern
  2 days ago

Yesterday

● Application submitted
  Microsoft
  Security Operations Intern
```

Use typography and spacing to establish hierarchy instead of large
colorful icons.

------------------------------------------------------------------------

# 26. ADD "NEEDS ATTENTION"

Introduce a product-specific operational component.

Example:

``` text
NEEDS ATTENTION

3 applications haven't received a response
in more than 7 days.

[ Review applications → ]
```

Or:

``` text
FOLLOW UP TODAY

Accenture
Custom Software Engineer

Applied 9 days ago

[ View application ]
```

This is more useful than another decorative metric card.

------------------------------------------------------------------------

# 27. APPLICATION AGE

Where relevant, display human-readable time:

``` text
Applied 8 days ago
```

rather than raw timestamps.

Use exact timestamps in secondary/detail views.

------------------------------------------------------------------------

# 28. COPYWRITING

Avoid generic AI-generated copy:

``` text
Supercharge your career.
Unlock powerful insights.
Transform your job search.
AI-powered career intelligence.
```

Use specific product language:

``` text
Your application pipeline at a glance.

3 applications are waiting for a response.

Follow up tomorrow.

Nothing needs your attention right now.
```

Copy should describe the actual state of the user's data.

------------------------------------------------------------------------

# 29. EMPTY STATES

Do NOT use:

``` text
🚀 Nothing here yet!
Start creating amazing things...
```

Use:

``` text
No applications yet

Applications you add will appear here.

[ Add application ]
```

Short and functional.

------------------------------------------------------------------------

# 30. ERROR STATES

Do NOT use:

``` text
Oops! Something went wrong 😅
```

Use:

``` text
We couldn't load your applications.

Your saved data is safe.
Try again.

[ Try again ]
```

For network issues:

``` text
You're offline.

Changes can't be saved until your connection returns.
```

------------------------------------------------------------------------

# 31. LOADING STATES

Avoid skeleton loaders everywhere.

Use real layout-preserving loading states.

For a dashboard metric:

``` text
Applications

Loading…
```

For tables, use skeleton rows only where layout stability matters.

For asynchronous status updates, use:

``` text
Updating status…
```

then:

``` text
Status updated
```

------------------------------------------------------------------------

# 32. BUTTON SYSTEM

Only create a small number of variants:

``` text
Primary
Secondary
Ghost
Danger
```

## Primary

``` css
background: #276568;
color: #FFFFFF;
```

Hover:

``` css
background: #1D4B4D;
```

Active:

``` css
transform: translateY(1px);
```

Focus:

``` css
outline: 3px solid rgba(76, 146, 144, 0.28);
outline-offset: 2px;
```

Do not use:

``` css
transform: scale(1.08);
```

for normal buttons.

------------------------------------------------------------------------

# 33. MOTION

Use subtle, intentional motion.

## Easing

``` css
--ease-standard:
  cubic-bezier(0.2, 0.8, 0.2, 1);

--ease-enter:
  cubic-bezier(0.16, 1, 0.3, 1);

--ease-exit:
  cubic-bezier(0.7, 0, 0.84, 0);
```

## Durations

``` text
Hover       120ms
Controls    140ms
Dropdown    160ms
Modal       200ms
Page        240ms
Complex UI  280ms
```

Do not use:

``` css
transition: all 0.5s ease;
```

globally.

Transition only properties that actually change.

------------------------------------------------------------------------

# 34. HOVER STATES

Avoid floating cards several pixels upward.

Do:

``` css
background: #F7F8F7;
border-color: #CBD1CF;
```

For clickable rows:

``` css
background: #F6F7F5;
```

Keep interaction subtle.

------------------------------------------------------------------------

# 35. ACCESSIBILITY

Implement:

-   visible keyboard focus
-   logical tab order
-   accessible labels
-   keyboard navigation
-   screen-reader-friendly buttons
-   sufficient contrast
-   reduced-motion support

Add:

``` css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

------------------------------------------------------------------------

# 36. RESPONSIVE DESIGN

## Desktop \>= 1200px

Use:

``` text
Sidebar | Main
```

Chart and activity can sit side by side.

Recommended:

``` text
Chart: 60–65%
Activity: 35–40%
```

Metrics should use a hierarchy rather than six equal cards.

------------------------------------------------------------------------

## Tablet 768--1199px

Collapse the sidebar into a compact navigation.

Use:

``` text
Top bar
```

Metrics:

``` text
Applications     Active
Interviews       Offers
```

Chart full width.

Activity below chart.

------------------------------------------------------------------------

## Mobile \<= 767px

Do NOT simply shrink the desktop layout.

Use:

``` text
Top bar
Overview
Primary metric
Pipeline
Chart
Needs attention
Recent activity
```

Use 16px horizontal padding.

Potential mobile navigation:

``` text
Overview
Applications
Alerts
```

Settings can live behind a menu.

------------------------------------------------------------------------

# 37. MOBILE HEADER

Example:

``` text
┌─────────────────────────────┐
│ ☰  Workday Tracker      +  │
└─────────────────────────────┘
```

The plus button should open the add-application flow.

------------------------------------------------------------------------

# 38. COMMAND PALETTE

Add:

``` text
Cmd/Ctrl + K
```

Actions:

``` text
Search applications
Add application
Open applications
Open notifications
Open settings
Search companies
```

This should feel like a productivity feature, not decoration.

------------------------------------------------------------------------

# 39. APPLICATION LIST

The Applications page should prioritize:

``` text
Company
Role
Status
Applied date
Last activity
Next action
```

Example:

``` text
Company       Role                  Status       Applied

Accenture     Software Engineer     Screening    8 days ago
IQVIA         Intern                Assessment   2 days ago
Microsoft     Security Intern       Rejected     6 days ago
```

Avoid putting every row inside a rounded card.

Use a proper table/list with subtle separators.

------------------------------------------------------------------------

# 40. PROGRESSIVE DISCLOSURE

Do not display every detail at once.

Collapsed row:

``` text
Accenture
Custom Software Engineer
Screening
Applied 8 days ago
```

Expanded:

``` text
Accenture
Custom Software Engineer

Applied:
Sep 12, 2026

Resume:
Resume_v4.pdf

Last activity:
Sep 19, 2026

Next action:
Follow up Sep 23

[ Open application ]
```

------------------------------------------------------------------------

# 41. SIGNATURE DESIGN ELEMENT

Introduce one subtle visual identity element.

Suggested:

``` css
.signature-rule {
  width: 28px;
  height: 2px;
  background: #4C9290;
}
```

Use beside selected section headings or important contextual headings.

Do not use it everywhere.

------------------------------------------------------------------------

# 42. ICON SYSTEM

Remove emoji from primary navigation and metrics.

Use a consistent icon library already present in the project if
available.

Preferred:

-   Lucide
-   Phosphor
-   Radix Icons

Recommended:

``` text
16px  dense UI
18px  standard
20px  primary controls
24px  major navigation
```

Stroke:

``` text
1.75
```

------------------------------------------------------------------------

# 43. AVOID THESE VISUAL PATTERNS

Remove/reduce:

``` text
❌ Purple-blue gradients
❌ Neon chart colors
❌ Glowing borders
❌ Glassmorphism
❌ Large circular decorations
❌ 20–24px radius everywhere
❌ Giant shadows
❌ Emoji-heavy UI
❌ AI robot graphics
❌ 3D floating objects
❌ Generic "AI-powered" copy
❌ Excessive uppercase text
❌ Every element inside a card
❌ Excessive animations
❌ Every metric having its own color
```

------------------------------------------------------------------------

# 44. DO USE THESE PATTERNS

``` text
✓ Warm neutral background
✓ Deep teal brand color
✓ Terracotta accent
✓ Typography-led hierarchy
✓ Semantic status colors
✓ Thin borders
✓ Subtle shadows
✓ 7–12px radii
✓ Consistent icon system
✓ Useful empty states
✓ Product-specific microcopy
✓ Activity timeline
✓ Pipeline visualization
✓ Needs-attention section
✓ Responsive information hierarchy
✓ Keyboard shortcuts
✓ Command palette
```

------------------------------------------------------------------------

# 45. DESIGN SYSTEM FILE STRUCTURE

Adapt to the existing project structure rather than blindly moving
files.

If appropriate, create:

``` text
src/
├── design-system/
│   ├── tokens/
│   │   ├── colors.css
│   │   ├── typography.css
│   │   ├── spacing.css
│   │   ├── shadows.css
│   │   ├── motion.css
│   │   └── index.css
│   │
│   ├── theme/
│   │   ├── light.css
│   │   └── dark.css
│   │
│   └── components/
│       ├── Button/
│       ├── Input/
│       ├── Card/
│       ├── Badge/
│       ├── Table/
│       ├── Dialog/
│       └── Tooltip/
│
├── components/
│   ├── navigation/
│   ├── dashboard/
│   ├── applications/
│   └── feedback/
│
├── layouts/
├── pages/
├── hooks/
├── lib/
└── styles/
    └── globals.css
```

Do not duplicate design tokens in individual components.

------------------------------------------------------------------------

# 46. CSS VARIABLES

Create a centralized system similar to:

``` css
:root {
  --color-primary: #276568;
  --color-primary-hover: #1D4B4D;
  --color-primary-active: #163A3D;

  --color-accent: #C8754D;

  --surface-page: #F6F7F5;
  --surface-primary: #FFFFFF;
  --surface-secondary: #EEF1EF;

  --text-primary: #17201F;
  --text-secondary: #4D5A57;
  --text-muted: #74807C;

  --border-subtle: #E8ECEA;
  --border-default: #DDE3E0;
  --border-strong: #CBD4D0;

  --success: #2E8059;
  --warning: #A97018;
  --error: #B84A42;
  --info: #327595;

  --radius-control: 7px;
  --radius-card: 10px;
  --radius-dialog: 12px;
  --radius-pill: 999px;

  --shadow-subtle:
    0 1px 2px rgba(23,32,31,.04);

  --shadow-card:
    0 4px 14px rgba(23,32,31,.06);

  --shadow-floating:
    0 12px 32px rgba(23,32,31,.10);

  --ease-standard:
    cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

------------------------------------------------------------------------

# 47. TAILWIND

If the project uses Tailwind, extend/replace the current generated theme
instead of scattering arbitrary values.

Create tokens for:

-   colors
-   spacing
-   radius
-   shadows
-   typography

Do not create dozens of nearly identical custom colors.

Do not use arbitrary Tailwind values everywhere.

Bad:

``` text
bg-[#6845ff]
rounded-[23px]
shadow-[0_15px_40px_rgba(...)]
```

throughout individual components.

Good:

``` text
bg-primary
rounded-card
shadow-card
```

Centralize design decisions.

------------------------------------------------------------------------

# 48. COMPONENT ARCHITECTURE

Use reusable components such as:

``` text
Button
Input
Select
Badge
Tooltip
Dialog
Metric
Pipeline
ActivityItem
ActivityTimeline
Chart
EmptyState
ErrorState
LoadingState
```

Do not create one-off styling for every page.

------------------------------------------------------------------------

# 49. DESIGN TOKEN PRINCIPLE

If the same value appears in three or more places, consider turning it
into a token.

Examples:

``` text
Primary color
Border color
Card radius
Control radius
Page background
Text colors
Standard shadow
```

This ensures future design changes can happen centrally.

------------------------------------------------------------------------

# 50. VISUAL HIERARCHY TARGET

The user's eye should naturally move:

``` text
1. Page title / current context
          ↓
2. Primary application numbers
          ↓
3. Pipeline
          ↓
4. Application trend
          ↓
5. Needs attention
          ↓
6. Recent activity
```

Do not let decorative elements interrupt this hierarchy.

------------------------------------------------------------------------

# 51. FINAL TARGET DASHBOARD

Aim for approximately:

``` text
┌──────────────────────────────────────────────────────────────┐
│ Workday Application Tracker                    Sep 20        │
│                                                              │
│ Overview                                                     │
│ Your application pipeline at a glance.                       │
│                                                              │
│ [+ Add application]                              [⌘K Search] │
│                                                              │
│ ┌───────────────────────┐ ┌───────────────────────────────┐ │
│ │ APPLICATIONS          │ │ ACTIVE PIPELINE               │ │
│ │                       │ │                               │ │
│ │ 39                    │ │ 34                            │ │
│ │ +5 this week          │ │ 7 awaiting response           │ │
│ └───────────────────────┘ └───────────────────────────────┘ │
│                                                              │
│ ┌────────────────────────────────┐ ┌──────────────────────┐ │
│ │ APPLICATIONS OVER TIME         │ │ PIPELINE             │ │
│ │                                │ │                      │ │
│ │          chart                 │ │ Applied       34     │ │
│ │                                │ │ Screening      8     │ │
│ │                                │ │ Interview      0     │ │
│ │                                │ │ Offer          0     │ │
│ │                                │ │ Rejected       4     │ │
│ └────────────────────────────────┘ └──────────────────────┘ │
│                                                              │
│ NEEDS ATTENTION                                              │
│                                                              │
│ 3 applications haven't received a response in 7+ days       │
│                                                   [Review]   │
│                                                              │
│ RECENT ACTIVITY                                              │
│                                                              │
│ ● Status updated       Accenture                 50 min ago  │
│ ● Assessment received  IQVIA Global               2 days ago │
│ ● Application sent     Microsoft                  3 days ago │
└──────────────────────────────────────────────────────────────┘
```

This is the target information architecture.

------------------------------------------------------------------------

# 52. IMPLEMENTATION PHASES

## Phase 1 --- Audit

Before changing code:

1.  Inspect the complete frontend.
2.  Identify the framework.
3.  Identify Tailwind/CSS/SCSS usage.
4.  Identify existing design tokens.
5.  Identify reusable UI components.
6.  Identify dashboard routes.
7.  Identify application data structures.
8.  Identify current responsive behavior.
9.  Identify all existing icon libraries.
10. Identify theme/dark-mode implementation.

Do not make assumptions.

------------------------------------------------------------------------

## Phase 2 --- Design Foundation

Implement:

-   color tokens
-   typography
-   spacing
-   borders
-   radius
-   shadows
-   motion
-   light theme
-   dark theme

Do this before rebuilding individual pages.

------------------------------------------------------------------------

## Phase 3 --- Global Components

Redesign:

-   buttons
-   inputs
-   badges
-   navigation
-   cards
-   dialogs
-   tables
-   tooltips
-   loading states
-   empty states
-   error states

------------------------------------------------------------------------

## Phase 4 --- Dashboard

Redesign:

1.  Sidebar
2.  Header
3.  Primary metrics
4.  Pipeline
5.  Chart
6.  Needs attention
7.  Activity timeline

------------------------------------------------------------------------

## Phase 5 --- Applications Page

Redesign:

-   filters
-   search
-   application table/list
-   status indicators
-   application details
-   actions
-   pagination if needed

------------------------------------------------------------------------

## Phase 6 --- Notifications

Use a chronological activity design.

Prioritize:

-   unread state
-   timestamp
-   company
-   application
-   action
-   CTA

Do not make every notification a large card.

------------------------------------------------------------------------

## Phase 7 --- Settings

Use clear sections:

``` text
Account
Notifications
Workday connection
Appearance
Data
Security
```

Avoid excessive card nesting.

------------------------------------------------------------------------

## Phase 8 --- Responsive QA

Test at:

``` text
1440 × 900
1280 × 800
1024 × 768
768 × 1024
390 × 844
```

Ensure no:

-   horizontal overflow
-   clipped text
-   broken tables
-   inaccessible controls
-   overlapping navigation
-   unreadable charts

------------------------------------------------------------------------

# 53. QUALITY GATE

Before considering the redesign complete, verify:

## Visual

-   [ ] Purple AI aesthetic removed
-   [ ] No unnecessary gradients
-   [ ] No decorative glowing elements
-   [ ] No emoji-based primary navigation
-   [ ] No excessive rounded cards
-   [ ] No giant shadows
-   [ ] Consistent typography
-   [ ] Strong information hierarchy
-   [ ] Consistent icon system

## UX

-   [ ] User can immediately see application count
-   [ ] User can immediately understand active pipeline
-   [ ] User can see important follow-ups
-   [ ] Recent activity is easy to scan
-   [ ] Application status is obvious
-   [ ] Primary CTA is useful
-   [ ] Empty states explain what to do
-   [ ] Errors explain recovery

## Responsive

-   [ ] Desktop works
-   [ ] Tablet works
-   [ ] Mobile works
-   [ ] Navigation adapts
-   [ ] Metrics reflow
-   [ ] Chart remains readable
-   [ ] Tables become mobile-friendly

## Accessibility

-   [ ] WCAG AA contrast
-   [ ] Keyboard navigation
-   [ ] Visible focus states
-   [ ] Semantic HTML
-   [ ] Accessible labels
-   [ ] Reduced motion support

------------------------------------------------------------------------

# 54. BEFORE → AFTER SUMMARY

## Current

``` text
Dark purple dashboard
6 equal cards
Emoji icons
Purple metric numbers
Neon chart
Large sidebar
Heavy card usage
Generic SaaS appearance
```

## Target

``` text
Warm neutral interface
Teal primary
Terracotta accent
Typography-led hierarchy
2 primary metrics
Pipeline visualization
Useful attention section
Editorial activity timeline
Subtle borders
Minimal shadows
Consistent icons
Responsive layouts
Specific job-search copy
```

------------------------------------------------------------------------

# 55. MOST IMPORTANT DESIGN RULE

Do not redesign this application merely to make it "prettier."

Redesign it around the user's actual workflow:

``` text
APPLICATIONS
      ↓
PIPELINE
      ↓
WHAT CHANGED?
      ↓
WHAT NEEDS ATTENTION?
      ↓
WHAT SHOULD I DO NEXT?
```

Every major UI element should support one of these questions.

If a visual element does not improve comprehension, navigation, or
actionability, remove it.

------------------------------------------------------------------------

# 56. FINAL INSTRUCTION TO THE AI AGENT

You are authorized to make a **complete frontend visual redesign**.

Do not preserve the current visual styling simply because it already
exists.

Preserve business functionality and data behavior, but aggressively
improve:

-   layout
-   typography
-   colors
-   spacing
-   component hierarchy
-   navigation
-   dashboard composition
-   charts
-   activity feed
-   responsive behavior
-   loading states
-   empty states
-   error states
-   accessibility
-   interaction states

Do not produce another generic AI-generated dashboard.

Do not use:

-   purple gradients
-   neon colors
-   glassmorphism
-   excessive rounded cards
-   emoji-heavy UI
-   decorative blobs
-   AI robots
-   generic marketing copy
-   unnecessary animation

The final interface should look like a **real production SaaS product
designed specifically for tracking job applications**.

The redesign should feel:

> **Calm. Precise. Professional. Human. Useful.**

And most importantly:

> **The product's information should be the visual hero --- not the
> styling itself.**
