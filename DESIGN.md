# DAFAX Bet Support — Design System & UX Layout
**Version:** 2.0  
**Last Updated:** June 2026

---

## 1. Design Philosophy

> **"Feels like a mobile app — not a website."**

Three rules that govern every decision:

1. **Mobile-first, always.** Every screen is designed for a 375px viewport first. Desktop is an enhancement.
2. **Instant and tactile.** Every tap gives feedback. No blank loading screens. Skeletons everywhere.
3. **Clarity over decoration.** One thing per screen has maximum visual weight. Everything else steps back.

---

## 2. Color System

### Base Palette

| Token | Hex | Role |
|---|---|---|
| `--primary` | `#635BFF` | Primary actions, buttons, active states |
| `--primary-hover` | `#4F46E5` | Hover / pressed |
| `--primary-light` | `#EEF2FF` | Agent bubble, badge background |
| `--surface` | `#FFFFFF` | Cards, sheets, modals |
| `--bg` | `#F7F8FC` | Page background |
| `--sidebar-bg` | `#111827` | Dark sidebar (agent/manager) |
| `--sidebar-active` | `#1F2937` | Active nav item in sidebar |
| `--text-1` | `#0F172A` | Headings, primary text |
| `--text-2` | `#64748B` | Secondary, labels, meta |
| `--text-3` | `#94A3B8` | Placeholders, timestamps |
| `--border` | `#E2E8F0` | Dividers, input borders |
| `--success` | `#10B981` | Online, converted, success |
| `--warning` | `#F59E0B` | Follow-up, pending |
| `--danger` | `#EF4444` | Error, close, destructive |
| `--info` | `#3B82F6` | Info states, new badge |

### Chat-Specific Tokens

| Token | Hex | Role |
|---|---|---|
| `--bubble-agent` | `#EEF2FF` | Agent message background |
| `--bubble-agent-text` | `#1E1B4B` | Agent message text |
| `--bubble-customer` | `#FFFFFF` | Customer message background |
| `--bubble-customer-text` | `#0F172A` | Customer message text |
| `--note-bg` | `#FEFCE8` | Internal note background |
| `--note-border` | `#FDE68A` | Internal note left border |

### Status Colors (Lead Badges)

| Status | Background | Text | Border |
|---|---|---|---|
| New | `#DBEAFE` | `#1D4ED8` | — |
| Assigned | `#EDE9FE` | `#6D28D9` | — |
| In Progress | `#FEF3C7` | `#92400E` | — |
| Follow-up | `#FFEDD5` | `#C2410C` | — |
| Interested | `#CCFBF1` | `#0F766E` | — |
| Converted | `#DCFCE7` | `#15803D` | — |
| Closed | — | `#6B7280` | `#D1D5DB` |

---

## 3. Typography

**Font Family:** `Inter` (Google Fonts — 400, 500, 600, 700)

| Style | Size | Weight | Line-height | Usage |
|---|---|---|---|---|
| Display | 22px | 700 | 1.2 | Page titles (rare) |
| Heading | 17px | 600 | 1.3 | Section headers |
| Body | 14px | 400 | 1.5 | Main content |
| Body Medium | 14px | 500 | 1.5 | Labels, nav items |
| Chat | 14px | 400 | 1.6 | Message text |
| Caption | 12px | 400 | 1.4 | Meta, timestamps, badges |
| Micro | 11px | 400 | 1.3 | Tick marks, read status |

---

## 4. Spacing & Shape

```
Base unit: 4px

Spacing scale:
  xs  = 4px
  sm  = 8px
  md  = 12px
  lg  = 16px
  xl  = 20px
  2xl = 24px
  3xl = 32px

Border radius scale:
  sm   = 6px   → Input fields, small badges
  md   = 10px  → Buttons, list items
  lg   = 14px  → Cards, modals, sheets
  xl   = 20px  → Message bubbles (agent)
  pill = 999px → Status badges, avatar indicators
  full = 50%   → Avatars

Shadows:
  card   = 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
  sheet  = 0 4px 24px rgba(0,0,0,0.10)
  float  = 0 8px 32px rgba(0,0,0,0.12)
```

---

## 5. Component Specs

### 5.1 Message Bubbles

```
CUSTOMER (left-aligned):
┌────────────────────────────────┐
│  Hello, I need help with my    │
│  deposit. Can you assist?      │
└────────────────────────────────┘
  10:32 AM

  • bg: --bubble-customer
  • border: 1px solid --border
  • border-radius: 4px 20px 20px 20px  (top-left flat = "tail" side)
  • max-width: 80%
  • padding: 10px 14px
  • box-shadow: card

AGENT (right-aligned):
                ┌────────────────────────────────┐
                │  Sure! Here's the deposit       │
                │  guide. Please follow step 1.  │
                └────────────────────────────────┘
                              10:33 AM  ✓✓

  • bg: --bubble-agent
  • border-radius: 20px 4px 20px 20px  (top-right flat)
  • max-width: 80%
  • padding: 10px 14px

INTERNAL NOTE (full-width):
┌────────────────────────────────────────────────┐
│ 📝  Customer seems hesitant — follow up tmr    │
│     Agent Priya  •  10:45 AM                   │
└────────────────────────────────────────────────┘
  • bg: --note-bg
  • left border: 3px solid --note-border
  • border-radius: 0 10px 10px 0
  • italic text
  • only visible to agents, managers, admins
```

### 5.2 Chat List Item

```
┌──────────────────────────────────────────────────┐
│  ┌──┐                                            │
│  │ A│  Rahul Sharma              10:32 AM        │
│  └──┘  Hello, I need help with deposit...  🔴 3  │
│        [In Progress]                             │
└──────────────────────────────────────────────────┘

Swipe LEFT → reveals:
  [📤 Transfer]  [✅ Close]  [📌 Pin]

  • item height: 72px
  • avatar: 40px circle, initials fallback
  • online dot: 10px circle, bottom-right of avatar
  • unread badge: red pill, min-width 20px
  • status badge: tiny pill below name
  • border-bottom: 1px solid --border
  • active state: bg --primary-light
  • transition: background 150ms ease
```

### 5.3 Buttons

```
PRIMARY BUTTON
  bg: --primary
  text: white, 14px, 600
  padding: 12px 20px
  border-radius: 10px
  min-height: 44px
  hover: --primary-hover (scale 0.98)
  active: scale 0.96

SECONDARY BUTTON
  bg: --surface
  border: 1px solid --border
  text: --text-1, 14px, 500
  padding: 11px 20px
  border-radius: 10px

ICON BUTTON (tap target)
  size: 44x44px
  bg: transparent → --bg on hover
  border-radius: 10px
  icon: 20px

DANGER BUTTON
  bg: #FEF2F2
  text: --danger, 14px, 500
  border: 1px solid #FECACA
```

### 5.4 Input Field

```
┌─────────────────────────────────────┐
│ 🔍  Search chats...                 │
└─────────────────────────────────────┘

  bg: --bg
  border: 1.5px solid --border
  border-radius: 10px
  padding: 11px 14px
  font: 14px, 400
  focus-border: --primary, box-shadow: 0 0 0 3px rgba(99,91,255,0.12)
  placeholder: --text-3
  height: 44px
```

### 5.5 Status Badge

```
  [● New]        → blue pill
  [● Assigned]   → purple pill
  [● In Progress]→ amber pill
  [● Converted]  → green pill
  [  Closed  ]   → gray outlined pill

  font: 11px, 600
  padding: 3px 8px
  border-radius: 999px
  dot: 5px circle, same color as text
```

### 5.6 Avatar

```
  sizes: 32px (list), 40px (chat header), 48px (profile)
  shape: 50%
  fallback: initials, 2 chars, font 600, --primary bg with white text
  online indicator: 10px green dot, border 2px white, bottom-right corner
```

---

## 6. Layout Architecture

### 6.1 Customer — Mobile App (375px)

```
STATUS BAR (system)
┌──────────────────────────────┐
│  [←]  DAFAX Support   [≡]   │  44px — Fixed topbar
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │  📣 Today's Offer      │  │  Swipeable banner (180px tall)
│  │  Get 100% bonus on...  │  │
│  └────────────────────────┘  │
│  ○ ● ○ ○  (dots)            │
│                              │
│  ▸ Grand bonus this weekend! │  Scrolling ticker (36px)
│                              │
├──────────────────────────────┤
│                              │
│      🟢  We're Online        │  Status card (centered)
│    Support available 24/7    │
│                              │
│  ┌────────────────────────┐  │
│  │   💬  Start New Chat   │  │  Primary CTA button (full-width, 52px)
│  └────────────────────────┘  │
│                              │
│  ── Previous Conversations ──│
│                              │
│  ┌────────────────────────┐  │
│  │ 📄 Chat #1 — Jun 28    │  │  Previous chat cards
│  │ Resolved • Deposit     │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ My Profile             │  │  Quick links
│  │ Help & FAQ             │  │
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘

Notes:
- No bottom nav on customer side (simple flow)
- "Start New Chat" is the only primary action — huge, centered
- Topbar: logo left, hamburger right (profile/logout)
- Banners from admin settings, lazy-loaded
```

### 6.2 Customer — Chat Screen (Mobile)

```
┌──────────────────────────────┐
│  [←]  Priya (Agent)  🟢     │  44px fixed header
│        Agent is typing...    │  (typing indicator replaces "online")
├──────────────────────────────┤
│                              │
│  ── Today ──                 │  Date separator (centered, caption)
│                              │
│  Hi I need help         │
│  with my withdrawal.    │
│  10:32 AM               │  Customer bubble (left)
│                              │
│              Sure! What's    │
│              your account?   │
│              10:33 AM ✓✓     │  Agent bubble (right)
│                              │
│  ← scroll loads older msgs   │
│                              │
│                              │  (flex-grow scrollable area)
│                              │
│                              │
├──────────────────────────────┤
│ 📎  😊  [Type a message...] ▶│  56px fixed input bar
└──────────────────────────────┘

Input bar details:
  • 📎 = attachment (image/file/audio)
  • 😊 = emoji + sticker picker (bottom sheet)
  • [Type...] = text input, grows up to 4 lines, then scrolls
  • ▶ = send button (purple, becomes active when text exists)
  • Keyboard pushes input up (use env(keyboard-inset-bottom))
```

### 6.3 Agent — Dashboard (Mobile)

```
┌──────────────────────────────┐
│  My Chats          🔔  👤    │  44px topbar
├──────────────────────────────┤
│  [🔍 Search chats...]        │  Search bar (full-width)
├──────────────────────────────┤
│  [All] [New] [Active] [Done] │  Filter chips (horizontal scroll)
├──────────────────────────────┤
│                              │
│  🟣 Rahul Sharma   10:32     │
│     Need deposit help... 🔴3 │  Chat list items
│     [In Progress]            │
│  ─────────────────────       │
│  🟢 Priya Patel    09:45     │
│     Withdrawal issue     ✓✓  │
│     [Follow-up]              │
│  ─────────────────────       │
│  ⚫ Anil Kumar    Yesterday  │
│     Account verify done      │
│     [Converted]              │
│                              │
└──────────────────────────────┘
│  💬 Chats  │  📋 Leads  │  👤 Me │  44px bottom nav
└────────────────────────────────┘

Bottom Nav:
  • Active tab: --primary icon + label
  • Inactive: --text-3
  • Notification dot on bell if unread
  • "Me" = profile, status toggle, logout
```

### 6.4 Agent — Chat Screen (Mobile)

```
┌──────────────────────────────┐
│ [←] Rahul Sharma  🟢  [⋮]  │  44px chat header
│      Customer ID: DAF-10291  │  (sub-line: customer ID)
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ In Progress  •  Jun 28   │ │  Lead status bar (collapsible)
│ │ [Update Status ▾]        │ │  — tap to change status
│ └──────────────────────────┘ │
├──────────────────────────────┤
│                              │  Chat area (scrollable)
│  [message bubbles]           │
│                              │
│                              │
├──────────────────────────────┤
│ [Quick Reply /]  [📝 Note]   │  Action strip above input
│ 📎  😊  [Type a message...] ▶│  Input bar
└──────────────────────────────┘

⋮ Menu (bottom sheet):
  • 📌 Pin Chat
  • 📤 Transfer Chat
  • ✅ Close Chat
  • 🔁 Reopen Chat
  • ⭐ Mark Important
  • 🔍 Search in Chat
  • 📤 Export Chat

Quick Reply (/ trigger):
  Bottom sheet slides up showing template list
  [Search templates...]
  ● Welcome message
  ● Deposit guide
  ● Withdrawal guide
  → Tap to insert into input

Internal Note (📝):
  Input turns yellow-tinted
  Placeholder: "Add internal note (only team sees this)"
  Send → styled as note bubble
```

### 6.5 Agent — Lead Detail (Mobile, Slide-in Panel)

```
← Back to Chats          Lead Detail
┌──────────────────────────────┐
│  👤  Rahul Sharma            │
│      📱 +91 98765 43210      │
│      ID: DAF-10291           │
│      Registered: Jun 28      │
├──────────────────────────────┤
│  LEAD STATUS                 │
│  [● In Progress    ▾]        │  Tap → status picker sheet
├──────────────────────────────┤
│  TAGS                        │
│  [deposit] [new-user] [+]   │
├──────────────────────────────┤
│  INTERNAL NOTES              │
│  📝 Jun 27 — Priya           │
│     "Sent deposit guide"     │
│  [+ Add Note]                │
├──────────────────────────────┤
│  TIMELINE                    │
│  ● Jun 28 10:32 — Assigned   │
│  ● Jun 27 09:15 — Created    │
└──────────────────────────────┘
```

---

## 7. Agent/Manager — Desktop Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ SIDEBAR (280px)              │  CHAT LIST (340px)  │  CHAT (flex)│
│ dark bg #111827              │                     │             │
│                              │                     │             │
│  [DAFAX Logo]                │  My Chats           │  Rahul Sharma 🟢
│                              │  [🔍 Search...]     │  DAF-10291
│  ●  Chats          [12]      │                     │  ─────────────
│  ○  Leads                    │  [All][New][Active] │
│  ○  Analytics (Mgr)          │                     │  [chat messages]
│  ○  Templates                │  Rahul Sharma 10:32 │
│  ─────────────────           │  Need help... 🔴3   │
│  ○  My Profile               │  [In Progress]      │  [note area]
│  ○  Set Status: 🟢 Online   │  ─────────────────  │
│  ○  Logout                   │  Priya Patel 09:45  │  ─────────────
│                              │  Withdrawal issue   │  📎😊[Type...] ▶
└──────────────────────────────┴─────────────────────┴─────────────┘

Right panel (Lead Detail — slides in from right, 320px):
  When agent clicks customer name in chat header
  → Customer info + status + notes + timeline
  Overlay or push layout (push preferred on wide screens)
```

---

## 8. Manager — Leads Table (Desktop)

```
┌─────────────────────────────────────────────────────────────────┐
│  All Leads                                        [+ Import]    │
│  [Search by name, mobile, ID...]  [Status ▾] [Agent ▾] [Date ▾]│
├────────┬────────────────┬─────────────┬────────────┬───────────┤
│  Name  │  Mobile        │  Status     │  Agent     │  Date     │
├────────┼────────────────┼─────────────┼────────────┼───────────┤
│  Rahul │  +91 987...    │ [In Progress│  Priya     │  Jun 28   │
│  Priya │  +91 876...    │ [Converted] │  Amit      │  Jun 27   │
│  Anil  │  +91 765...    │ [New]       │  Unassigned│  Jun 28   │
├────────┴────────────────┴─────────────┴────────────┴───────────┤
│  ← 1 2 3 4 →   Showing 1-20 of 148                            │
└─────────────────────────────────────────────────────────────────┘

Row actions (hover reveals):
  [Open Chat] [Reassign ▾] [Change Status ▾]
```

---

## 9. Admin Panel — Desktop Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ADMIN SIDEBAR (240px)          │  CONTENT AREA (flex)       │
│  dark bg #111827                │                            │
│                                 │                            │
│  [DAFAX Admin]                  │  ┌──── Content Card ─────┐ │
│                                 │  │                       │ │
│  ── Overview                    │  │  Section heading      │ │
│  ● Dashboard                    │  │  Description text     │ │
│                                 │  │                       │ │
│  ── Customization               │  │  [form fields]        │ │
│  ○  Branding                    │  │                       │ │
│  ○  Banners                     │  │  [Save Changes]       │ │
│  ○  Announcements               │  └───────────────────────┘ │
│                                 │                            │
│  ── Content                     │                            │
│  ○  Sticker Packs               │                            │
│  ○  Quick Templates             │                            │
│                                 │                            │
│  ── Users                       │                            │
│  ○  Agents                      │                            │
│  ○  Managers                    │                            │
│                                 │                            │
│  ── System                      │                            │
│  ○  Audit Logs                  │                            │
│  ○  Import / Export             │                            │
│  ○  Settings                    │                            │
│                                 │                            │
└─────────────────────────────────┴────────────────────────────┘
```

### Admin — Branding Settings

```
┌──────────────────────────────────────────────────────────────┐
│  Branding                                                    │
│  Changes apply instantly across the platform.               │
├──────────────────────┬───────────────────────────────────────┤
│  FORM FIELDS         │  LIVE PREVIEW (phone frame)           │
│                      │                                       │
│  Company Name        │  ┌────────────────┐                  │
│  [DAFAX Bet      ]   │  │ [Logo] DAFAX   │                  │
│                      │  │ 🟢 Online      │                  │
│  Logo (upload)       │  │  💬 Chat Now   │                  │
│  [Choose File]       │  └────────────────┘                  │
│                      │                                       │
│  Primary Color       │                                       │
│  [■ #635BFF      ]   │                                       │
│                      │                                       │
│  "Play Now" Label    │                                       │
│  [Play Now       ]   │                                       │
│                      │                                       │
│  "Play Now" URL      │                                       │
│  [https://...    ]   │                                       │
│                      │                                       │
│  [Save Branding]     │                                       │
└──────────────────────┴───────────────────────────────────────┘
```

### Admin — Analytics Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  Live Overview                          Last updated: just now│
├────────────────┬──────────────┬──────────────┬───────────────┤
│  1,284         │  47          │  12          │  3            │
│  Total Customers│ Online Now  │ Active Chats │ Waiting >5min │
├────────────────┴──────────────┴──────────────┴───────────────┤
│  Today's Registrations    Today's Conversions    Avg Response │
│       23                       8                  1m 42s      │
├──────────────────────────────────────────────────────────────┤
│  Daily Registrations (bar chart, 30 days)                    │
│  ▁▂▃▅▄▆▇█▅▄▃▂▄▅▆▅▄▃▂▃▄▅▆▅▄▅▆▇█                             │
├───────────────────────────────┬──────────────────────────────┤
│  Agent Performance            │  Lead Status Breakdown        │
│  Name     Chats  Conv.  Avg   │  ■ New          12%          │
│  Priya      45    12   1m 30s │  ■ In Progress  34%          │
│  Amit       32     9   2m 10s │  ■ Converted    28%          │
│  Sneha      28     6   1m 55s │  ■ Closed       26%          │
└───────────────────────────────┴──────────────────────────────┘
```

---

## 10. Micro-Interactions & Motion

```
ENTRY ANIMATIONS:
  • Chat list items: slide in from left, staggered 40ms
  • Modals/sheets: slide up from bottom (320ms, ease-out cubic)
  • New message: pop in (scale 0.9→1, opacity 0→1, 160ms)
  • Toast: slide in from top (200ms), auto-dismiss 3s

FEEDBACK:
  • Button press: scale(0.97) 100ms
  • Swipe to reveal: follows finger, elastic snap-back
  • Send message: instant append + shimmer tick mark
  • Unread badge: scale pulse (1→1.2→1) on new message

LOADING STATES:
  • Chat list: skeleton rows (3 rows, shimmer animation)
  • Chat history: top skeleton while paginating
  • Media: blurred placeholder → fade in on load
  • Submit buttons: spinner replaces icon, disabled

TRANSITIONS:
  • Screen push: 240ms slide (iOS-style)
  • Tab switch: fade 160ms
  • Sidebar open (mobile): drawer from left, 280ms
```

---

## 11. Mobile UX Rules

| Rule | Implementation |
|---|---|
| All tap targets | Min 44×44px |
| Keyboard handling | `env(safe-area-inset-bottom)` for input bar |
| Swipe back | Gesture on chat screen → back to list |
| Pull to refresh | Chat list + lead list |
| Haptic feedback | Tap, long press, swipe reveal |
| Scroll restoration | Saved per route |
| Overscroll prevention | `overscroll-behavior: contain` on chat |
| Safe area | Respect notch and home bar on iOS |
| No hover-only actions | Every action also tappable |
| Empty states | Illustration + clear action prompt |

---

## 12. Empty States

```
AGENT — No Chats:
  ┌──────────────────────────┐
  │                          │
  │   💬  (icon, 64px)       │
  │                          │
  │  No chats yet            │  (heading)
  │  New leads will appear   │  (caption)
  │  here when assigned.     │
  │                          │
  └──────────────────────────┘

MANAGER — All Leads Empty:
  📋  No leads match your filters.
      [Clear Filters]

CUSTOMER — No Previous Chats:
  💬  This is the start of your
      support journey. Tap below
      to chat with us.
      [Start Your First Chat]
```

---

## 13. Error & Toast States

```
SUCCESS TOAST (green, top):
  ✓  Lead status updated to "Converted"

ERROR TOAST (red, top):
  ✗  Failed to send message. Tap to retry.

INFO TOAST (blue, top):
  ℹ  Chat transferred to Amit

WARNING INLINE (inside form):
  ⚠  Mobile number already registered.

  Toast specs:
    position: fixed top-4 right-4 (desktop), top-4 center (mobile)
    border-radius: 10px
    padding: 12px 16px
    shadow: --shadow-float
    auto-dismiss: 4s
    z-index: 9999
```

---

## 14. Accessibility

- Color contrast: all text ≥ 4.5:1 against background
- Focus rings: 2px `--primary` offset 2px, visible on all interactive elements
- ARIA roles: `role="dialog"` on modals, `role="log"` on chat area, `aria-live="polite"` on typing indicator
- Screen reader labels on all icon buttons (`aria-label`)
- Keyboard navigation: Tab order follows visual order
- Reduced motion: `@media (prefers-reduced-motion)` disables all transitions
- Font size: no text below 11px rendered

---

## 15. Screen Inventory

| Screen | Role | Type |
|---|---|---|
| Register | Customer | Mobile full |
| OTP Verify | Customer | Mobile full |
| Login | All | Mobile full |
| Customer Home | Customer | Mobile full |
| Customer Chat | Customer | Mobile full |
| Agent Chat List | Agent | Mobile + Desktop |
| Agent Chat Screen | Agent | Mobile + Desktop |
| Agent Lead Detail | Agent | Slide panel |
| Manager Lead Table | Manager | Desktop primary |
| Manager Analytics | Manager | Desktop |
| Admin — Branding | Super Admin | Desktop |
| Admin — Banners | Super Admin | Desktop |
| Admin — Announcements | Super Admin | Desktop |
| Admin — Stickers | Super Admin | Desktop |
| Admin — Templates | Super Admin | Desktop |
| Admin — Users | Super Admin | Desktop |
| Admin — Analytics | Super Admin | Desktop |
| Admin — Audit Logs | Super Admin | Desktop |
| Admin — Import/Export | Super Admin | Desktop |

---

## 16. CSS Variable Reference (Root)

```css
:root {
  /* Brand */
  --primary: #635BFF;
  --primary-hover: #4F46E5;
  --primary-light: #EEF2FF;

  /* Surface */
  --surface: #FFFFFF;
  --bg: #F7F8FC;
  --border: #E2E8F0;

  /* Sidebar */
  --sidebar-bg: #111827;
  --sidebar-active: #1F2937;
  --sidebar-text: #9CA3AF;
  --sidebar-text-active: #FFFFFF;

  /* Text */
  --text-1: #0F172A;
  --text-2: #64748B;
  --text-3: #94A3B8;

  /* Semantic */
  --success: #10B981;
  --warning: #F59E0B;
  --danger: #EF4444;
  --info: #3B82F6;

  /* Chat */
  --bubble-agent: #EEF2FF;
  --bubble-agent-text: #1E1B4B;
  --bubble-customer: #FFFFFF;
  --bubble-customer-text: #0F172A;
  --note-bg: #FEFCE8;
  --note-border: #FDE68A;

  /* Shape */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-bubble: 20px;
  --radius-pill: 999px;

  /* Shadow */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-sheet: 0 4px 24px rgba(0,0,0,0.10);
  --shadow-float: 0 8px 32px rgba(0,0,0,0.12);

  /* Timing */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms;
  --duration-base: 220ms;
  --duration-slow: 320ms;
}
```

---

*Document Owner: DAFAX Bet Support Design Team*
*Version: 2.0 — June 2026*
