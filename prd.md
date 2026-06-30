# DAFAX Bet Support — Product Requirements Document
**Version:** 1.1
**Status:** Final
**Build Phase:** 5-Step Complete Development Plan

> **Note:** UI/Design system is documented separately in the dedicated Design Document. This PRD covers product, architecture, data, and build plan only.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Database Schema](#3-database-schema)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Complete Feature Specifications](#5-complete-feature-specifications)
6. [5-Step Build Plan](#6-5-step-build-plan)
7. [Security & Performance](#7-security--performance)
8. [API Architecture](#8-api-architecture)
9. [Future Enhancements](#9-future-enhancements)

---

## 1. Project Overview

**DAFAX Bet Support** is a real-time Customer Support & Lead Management Platform built to completely replace WhatsApp-based support. It provides a centralized, branded environment where customers can chat with agents, and where agents, managers, and admins efficiently handle conversations and leads.

### Core Goals

- Replace WhatsApp support entirely
- Centralize all customer conversations in one platform
- Auto-create a lead on every new customer registration
- Enable real-time agent-to-customer communication
- Auto or manually assign leads to agents
- Speed up support using quick-reply templates
- Maintain full conversation history forever
- Support bulk import/export of customer data
- Scale to thousands of concurrent users
- Allow full branding from the Admin Panel — zero code changes required

---

## 2. Technology Stack

### Frontend
- **React.js** — Component-based SPA
- **Tailwind CSS** — Utility-first styling (CSS variables for theming)
- **React Query** — Server state, caching, background refetch
- **Socket.IO Client** — Real-time bidirectional events
- **React Router v6** — Client-side routing
- **Framer Motion** — Micro-animations, page transitions
- **React Hook Form** — Forms with validation

### Backend
- **Node.js + Express.js** — REST API server
- **Socket.IO** — WebSocket server with Redis adapter
- **Bull (Redis Queue)** — Background job processing

### Authentication
- **JWT** — Access + refresh tokens issued on login, used for all session/auth flows
- **bcryptjs** — Password hashing
- **Mobile number + password** — Primary login credential (no third-party OTP/auth provider)

### Database
- **MongoDB** — Primary data store (with Mongoose ODM)
- **Redis** — Sessions, online users, pub/sub, queues, caching

### Media Storage
- **Cloudinary** — Images, audio, documents, files
  - Auto-compress on upload
  - CDN delivery globally

### Infrastructure
- **PM2** — Node.js process manager
- **Nginx** — Reverse proxy, load balancer
- **Docker** (optional) — Containerized deployment

---

## 3. Database Schema

### Collections

#### `users` (unified auth)
```json
{
  "_id": "ObjectId",
  "fullName": "string",
  "mobile": "string (unique)",
  "passwordHash": "string",
  "role": "customer | agent | manager | super_admin",
  "isVerified": "boolean",
  "createdAt": "Date",
  "lastLogin": "Date",
  "isActive": "boolean"
}
```

#### `customers`
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId → users",
  "customerId": "string (auto-generated)",
  "fullName": "string",
  "mobile": "string",
  "registrationDate": "Date",
  "lastSeen": "Date",
  "assignedAgent": "ObjectId → users",
  "leadStatus": "enum",
  "tags": ["string"],
  "notes": ["string"],
  "isOnline": "boolean"
}
```

#### `leads`
```json
{
  "_id": "ObjectId",
  "customerId": "ObjectId → customers",
  "assignedAgent": "ObjectId → users",
  "status": "new | assigned | in_progress | follow_up | interested | converted | closed",
  "timeline": [{ "event": "string", "date": "Date", "by": "ObjectId" }],
  "lastActivity": "Date",
  "chatId": "ObjectId → chats",
  "internalNotes": [{ "text": "string", "by": "ObjectId", "date": "Date" }]
}
```

#### `chats`
```json
{
  "_id": "ObjectId",
  "customerId": "ObjectId → customers",
  "agentId": "ObjectId → users",
  "leadId": "ObjectId → leads",
  "status": "active | closed | transferred",
  "isPinned": "boolean",
  "isImportant": "boolean",
  "createdAt": "Date",
  "closedAt": "Date",
  "lastMessageAt": "Date"
}
```

#### `messages`
```json
{
  "_id": "ObjectId",
  "chatId": "ObjectId → chats",
  "senderId": "ObjectId → users",
  "senderRole": "customer | agent | manager | super_admin",
  "type": "text | image | audio | document | file | sticker | emoji | link",
  "content": "string",
  "mediaUrl": "string (Cloudinary URL)",
  "mediaPublicId": "string",
  "isInternal": "boolean",
  "status": "sent | delivered | read",
  "readAt": "Date",
  "deliveredAt": "Date",
  "createdAt": "Date"
}
```

#### `templates`
```json
{
  "_id": "ObjectId",
  "title": "string",
  "body": "string",
  "category": "string",
  "order": "number",
  "createdBy": "ObjectId → users",
  "isActive": "boolean"
}
```

#### `sticker_packs`
```json
{
  "_id": "ObjectId",
  "name": "string",
  "category": "string",
  "isEnabled": "boolean",
  "stickers": [{ "url": "string", "publicId": "string", "tags": ["string"] }]
}
```

#### `notifications`
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId → users",
  "type": "string",
  "title": "string",
  "body": "string",
  "isRead": "boolean",
  "createdAt": "Date",
  "metadata": "object"
}
```

#### `banners`
```json
{
  "_id": "ObjectId",
  "type": "promotional | offer | festival | maintenance",
  "imageUrl": "string",
  "title": "string",
  "isActive": "boolean",
  "scheduledAt": "Date",
  "expiresAt": "Date",
  "order": "number"
}
```

#### `announcements`
```json
{
  "_id": "ObjectId",
  "type": "popup | scrolling | header | system",
  "content": "string",
  "isActive": "boolean",
  "scheduledAt": "Date",
  "expiresAt": "Date"
}
```

#### `settings`
```json
{
  "_id": "ObjectId",
  "key": "string (unique)",
  "value": "any",
  "group": "branding | homepage | system | notifications",
  "updatedBy": "ObjectId",
  "updatedAt": "Date"
}
```

#### `audit_logs`
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId → users",
  "action": "string",
  "entity": "string",
  "entityId": "ObjectId",
  "before": "object",
  "after": "object",
  "ip": "string",
  "createdAt": "Date"
}
```

**Other collections:** `lead_assignments`, `sessions`, `departments`, `roles`, `permissions`, `activities`, `files`

---

## 4. User Roles & Permissions

### Permission Matrix

| Feature | Customer | Agent | Manager | Super Admin |
|---|---|---|---|---|
| Register / Login | ✅ | ✅ | ✅ | ✅ |
| Start Chat | ✅ | — | — | — |
| Reply in Chat | — | ✅ (assigned) | ✅ | ✅ |
| View Own Chats | ✅ | ✅ | ✅ | ✅ |
| View All Chats | — | — | ✅ | ✅ |
| View Assigned Leads | — | ✅ | ✅ | ✅ |
| View All Leads | — | — | ✅ | ✅ |
| Assign Leads | — | — | ✅ | ✅ |
| Transfer Leads | — | Conditional | ✅ | ✅ |
| Add Internal Notes | — | ✅ | ✅ | ✅ |
| Update Lead Status | — | ✅ | ✅ | ✅ |
| Manage Templates | — | — | ✅ | ✅ |
| Manage Sticker Packs | — | — | — | ✅ |
| Manage Banners | — | — | — | ✅ |
| Manage Announcements | — | — | — | ✅ |
| Configure Branding | — | — | — | ✅ |
| Create Agents | — | — | — | ✅ |
| Create Managers | — | — | — | ✅ |
| Import / Export Data | — | — | ✅ | ✅ |
| View Analytics | — | — | ✅ | ✅ |
| View Audit Logs | — | — | — | ✅ |

---

## 5. Complete Feature Specifications

### 5.1 Authentication

#### Customer Registration
1. Customer clicks **Support** button on the website
2. Registration form opens: Full Name, Mobile Number, Password
3. Password is hashed (bcrypt) and account is created directly in MongoDB
4. JWT access + refresh tokens issued immediately
5. Account created → Lead auto-created → Redirect to Customer Dashboard
6. Customer stays logged in until manual logout or token expiry

#### All Users Login
1. Enter Mobile Number + Password
2. Password verified against bcrypt hash
3. JWT (access + refresh) issued on success
4. WebSocket connection established using access token
5. Dashboard opens based on role

#### Session Handling
- Access token: short-lived, used for API calls and Socket.IO handshake
- Refresh token: long-lived, stored as HttpOnly secure cookie, used to silently re-issue access tokens
- Logout invalidates refresh token (server-side denylist via Redis)

---

### 5.2 Customer Dashboard

**Header:**
- Company Logo (from branding settings)
- Company Name (from branding settings)
- "Play Now" button (URL from settings)
- Online Support Status indicator (Online / Offline)

**Content Area:**
- Promotional Banner (swipeable carousel)
- Offer Banner
- Scrolling Announcement bar
- "Start Chat" CTA
- Previous Conversations list
- Customer Profile shortcut
- Help & FAQ section

---

### 5.3 Real-Time Chat

#### Messaging Features
- Real-time messaging via Socket.IO
- Typing indicator ("Agent is typing...")
- Online/Offline status for both parties
- Message statuses: Sent → Delivered → Read (tick marks)
- Auto-reconnect on network interruption
- Infinite scroll for chat history (lazy load older messages)
- Message search within chat

#### Media Sharing
Customers and agents can share:
- Images (compressed via Cloudinary before display)
- Voice Notes (recorded in-app, uploaded to Cloudinary)
- Documents (PDF, DOC, XLS, etc.)
- Files (any type up to admin-defined size limit)
- Links (auto-preview)
- Emojis (full emoji picker)
- Stickers (from sticker packs)

#### Chat Actions Menu
- Pin Chat
- Close Chat
- Reopen Chat
- Transfer Chat
- Mark as Important
- Search in Messages
- Export Chat (PDF/text)
- Copy Message

---

### 5.4 Quick Reply Templates

Agents can access pre-built templates while typing. System triggers when agent types `/` or clicks the template icon.

**Default Categories:**
- Welcome
- Registration Help
- Deposit Guide
- Withdrawal Guide
- Bonus Details
- Verification Guide
- Password Reset
- Follow-up Reminder
- Thank You

**Manager/Admin can:**
- Create, Edit, Delete templates
- Assign categories
- Reorder (drag-and-drop)
- Preview before saving

---

### 5.5 Sticker System

- Admin uploads sticker packs (sets of `.webp` or `.gif` files)
- Each pack has a category (Greetings, Thank You, Congratulations, Offers, etc.)
- Users can mark favorite stickers
- Recently used stickers section (last 20)
- Search stickers by tag
- Admin can enable/disable packs per role

---

### 5.6 Internal Notes

- Private notes on any conversation
- Only visible to assigned agent, managers, and super admin
- Visually distinct from regular chat messages
- Included in exported chat logs for authorized roles

---

### 5.7 Lead Management

#### Lead Auto-Creation Flow
```
Customer Registers
       ↓
Lead Created (status: New)
       ↓
Added to Assignment Queue
       ↓
Auto Assign (Round Robin) OR Manager Assigns Manually
       ↓
Status: Assigned → Agent Notified → Chat Begins
```

#### Lead Status Progression
```
New → Assigned → In Progress → Follow-up → Interested → Converted → Closed
```

Every status change is recorded in the lead's timeline with timestamp and who made the change.

#### Lead Transfer
When transferring a lead:
- Select target agent
- Add transfer reason (optional note)
- Full conversation history moves with the lead
- New agent receives notification
- Old agent loses access

---

### 5.8 Admin Customization Panel

All settings stored in the `settings` collection and applied without deployment.

#### Branding Settings
- Company Name
- Logo (upload via Cloudinary)
- Favicon
- Primary Color
- Secondary Color
- Header background
- Footer text

#### Homepage Customization
- Welcome Text
- Support Header
- Promotional Banner images
- Offer Banner images
- Announcement text
- Play Now button URL and label
- Help text

#### Banner Management
- Upload banners with title and type
- Schedule publish date/time
- Set expiry date/time
- Drag to reorder
- Toggle active/inactive

#### Announcement Management
- Popup (appears once per session)
- Scrolling bar (horizontal scroll on header)
- Header banner
- System notification (all connected users)

---

### 5.9 Notification System

**WebSocket Events (real-time):**

| Role | Event | Trigger |
|---|---|---|
| Customer | `new_message` | Agent sends message |
| Customer | `agent_assigned` | Lead assigned |
| Customer | `chat_closed` | Agent closes chat |
| Customer | `announcement` | Admin publishes announcement |
| Agent | `new_lead` | Lead assigned to them |
| Agent | `customer_message` | Customer sends message |
| Agent | `lead_reassigned` | Lead transferred away |
| Agent | `followup_reminder` | Scheduled follow-up due |
| Manager | `waiting_queue_alert` | Leads waiting > X minutes |
| Manager | `agent_offline` | Agent goes offline with open chats |
| Manager | `missed_chat` | Customer message unanswered > X minutes |
| Manager | `high_priority_lead` | Lead marked important |

Notifications stored in `notifications` collection for history.

---

### 5.10 Search & Filters

**Search by:**
- Customer Name
- Mobile Number
- Customer ID
- Assigned Agent
- Lead Status
- Registration Date Range
- Tags

**Quick Filters:**
- Today's Leads
- New (unassigned) Leads
- Assigned Leads
- Converted Leads
- Closed Leads
- Active Chats
- Last 7 Days
- Last 30 Days

---

### 5.11 Import & Export

#### Import (CSV / Excel)
- Upload file → preview first 10 rows
- Column mapping UI (drag columns to match fields)
- Duplicate detection by mobile number
- Validation errors shown per row before import
- Bulk import with progress indicator
- Success/fail summary after import

#### Export (CSV / Excel)
- Select date range
- Select fields to include:
  - Full Name, Mobile, Registration Date
  - Assigned Agent, Lead Status
  - Last Login, Last Chat Date
  - Tags, Notes
- Download triggers as background job
- Email notification when ready (for large exports)

---

### 5.12 Analytics Dashboard

#### Live Stats Cards
| Card | Data |
|---|---|
| Total Customers | Count of all registered customers |
| Online Now | Active WebSocket connections |
| Active Chats | Chats with status = active |
| Waiting Queue | Leads unassigned or no agent response |
| Available Agents | Agents currently online |
| Today's Registrations | New registrations today |
| Today's Conversions | Leads converted today |
| Avg. Response Time | Time from customer message to first agent reply |

#### Reports (Chart Views)
- Daily Registrations (bar chart, last 30 days)
- Weekly Growth (line chart)
- Monthly Growth (line chart)
- Agent Performance (table: chats handled, avg response time, conversions)
- Chat Volume by Hour (heatmap)
- Conversion Rate over time
- Peak Support Hours

---

## 6. 5-Step Build Plan

The entire project is divided into 5 sequential steps. Each step produces a working, testable deliverable before moving to the next.

---

### Step 1 — Foundation & Authentication
**Timeline: Week 1–2**

**Goal:** Core infrastructure, database, auth, and basic routing are live.

**Backend Tasks:**
- Initialize Node.js + Express project structure
- Connect MongoDB + Redis
- Design and create all MongoDB collections with indexes
- Implement JWT-based registration and login (mobile + password, bcrypt hashing)
- Implement access/refresh token issuance and middleware
- Build user registration and login endpoints
- Role-based route protection middleware
- Basic error handling and logging setup
- Environment config (`.env`) structure

**Frontend Tasks:**
- Initialize React project with Tailwind CSS
- Setup React Router with role-based protected routes
- Build Registration screen (Name + Mobile + Password)
- Build Login screen
- Setup global auth context (JWT storage, token refresh, user state)
- Setup Socket.IO client (connect on login, disconnect on logout)
- Build placeholder dashboards for each role

**Deliverable:** A user can register, log in, and land on their role-specific dashboard. Roles are enforced on all routes.

---

### Step 2 — Real-Time Chat Core
**Timeline: Week 3–4**

**Goal:** Fully working real-time chat between customer and agent.

**Backend Tasks:**
- Socket.IO server setup with Redis adapter
- Chat creation on first customer message
- Message send/receive events
- Typing indicator event
- Online/Offline status tracking in Redis
- Message delivery and read receipt events
- Message history API (paginated)
- Cloudinary integration for media uploads
- File upload API (image, audio, document)

**Frontend Tasks:**
- Customer chat screen (bubble UI, input bar)
- Agent chat screen (same core, different layout)
- Real-time message rendering
- Typing indicator display
- Read receipts (tick marks)
- Online status badge
- Media upload UI (image picker, file picker, voice recorder)
- Infinite scroll for chat history
- Auto-reconnect handling
- Emoji picker integration
- Message search within chat

**Deliverable:** Customer sends a message → appears instantly on agent screen. Media sharing works. Full chat UI feels like a native messaging app.

---

### Step 3 — Lead Management & Agent Workflow
**Timeline: Week 5–6**

**Goal:** Lead lifecycle, assignment, agent dashboard fully functional.

**Backend Tasks:**
- Auto-create lead on customer registration
- Lead assignment API (auto Round Robin + manual)
- Lead status update API
- Lead transfer API
- Lead timeline recording
- Internal notes API
- Agent lead list API (only assigned leads)
- Manager all-leads API with filters
- Quick reply templates CRUD
- Lead search and filter API

**Frontend Tasks:**
- Agent Dashboard: chat list with lead status badges
- Lead detail panel (customer info, status, timeline, notes)
- Lead status change dropdown
- Internal notes input and display
- Lead assignment UI (Manager: assign dropdown)
- Lead transfer modal (select new agent + reason)
- Quick reply template picker in chat input
- Manager: all leads table with search/filter
- Manager: lead assign / reassign UI

**Deliverable:** A new customer registers → lead is created and auto-assigned → agent sees it in their dashboard → agent manages full lead lifecycle.

---

### Step 4 — Admin Panel, Notifications & Stickers
**Timeline: Week 7–8**

**Goal:** Complete admin control, notification system, sticker packs.

**Backend Tasks:**
- Settings API (get/update all branding and homepage config)
- Banner CRUD with scheduling
- Announcement CRUD
- Sticker pack upload and management API
- Notification creation and delivery via Socket.IO
- Notification history API
- Agent/Manager/Super Admin user management APIs
- Audit log recording on all sensitive actions
- Analytics API (all stats and report data)

**Frontend Tasks:**
- Super Admin Panel layout with sidebar nav
- Branding settings form (live preview on save)
- Homepage customization form
- Banner management (upload, schedule, drag to reorder)
- Announcement management
- Sticker pack uploader and category manager
- User management screens (create/edit agents, managers)
- Notification bell with dropdown (real-time updates)
- Sticker picker in chat (categories, favorites, search)
- Analytics Dashboard with charts (recharts or Chart.js)

**Deliverable:** Admin can fully brand the platform, manage banners and announcements, upload sticker packs, manage all users, and view live analytics — all without touching code.

---

### Step 5 — Polish, Performance & Launch-Ready
**Timeline: Week 9–10**

**Goal:** Production-ready: performance optimized, secure, fully tested.

**Backend Tasks:**
- API rate limiting (express-rate-limit)
- Helmet.js security headers
- Input validation on all endpoints (Zod or Joi)
- Secure cookies for JWT refresh tokens
- Redis caching for frequently accessed data (settings, templates)
- Background workers for export jobs (Bull queues)
- MongoDB index audit and optimization
- Redis Pub/Sub validation for multi-instance scaling
- Import/Export feature (CSV/Excel with column mapping)

**Frontend Tasks:**
- Import UI (file upload → preview → column mapping → import)
- Export UI (field selection → download)
- Chat export (PDF/text)
- Mobile responsive QA on all screens (375px – 428px)
- Loading skeletons on all data-fetching screens
- Error boundary components
- Toast notification system
- Empty states on all list screens
- Accessibility: ARIA labels, keyboard navigation
- PWA manifest + service worker (offline awareness)
- Performance: lazy load routes, image lazy load, virtualized chat list

**Deliverable:** Platform is fully production-ready. Mobile feels like a native app. All security, performance, and polish items are complete.

---

## 7. Security & Performance

### Security Measures

| Layer | Implementation |
|---|---|
| Authentication | JWT (access + refresh) + bcrypt password hashing |
| Transport | HTTPS everywhere (SSL/TLS) |
| Access Control | Role-Based Access Control on every API route |
| API Protection | Rate limiting per IP and per user |
| Input Safety | Sanitize and validate all inputs (Zod/Joi) |
| Headers | Helmet.js (XSS, CSP, HSTS, no-sniff) |
| Cookies | HttpOnly, Secure, SameSite=Strict (refresh token) |
| Audit Trail | All sensitive actions logged to `audit_logs` |
| Data | Sensitive fields encrypted at rest |
| Media | Cloudinary signed URLs, no direct file access |

### Performance Architecture

| Concern | Solution |
|---|---|
| Real-time messaging | Socket.IO with Redis Pub/Sub adapter |
| Session management | Redis (TTL-based session cache) |
| Online user tracking | Redis Sets |
| API response speed | Redis cache for settings, templates |
| Message history | MongoDB with indexed `chatId + createdAt` |
| Media delivery | Cloudinary CDN (global edge) |
| Large file handling | Cloudinary upload streams, not memory buffers |
| Chat history loading | Cursor-based pagination (no skip/offset) |
| Heavy exports | Bull background queue + email notification |
| Multi-instance scaling | PM2 cluster + Nginx load balancer |
| Frontend performance | React lazy loading, code splitting, virtual list for chat |

---

## 8. API Architecture

### REST API Routes Overview

```
POST   /api/auth/register            Customer registration
POST   /api/auth/login               Login (all roles)
POST   /api/auth/refresh             Refresh access token
POST   /api/auth/logout              Logout

GET    /api/customers                List customers (Manager+)
GET    /api/customers/:id            Customer profile

GET    /api/leads                    List leads (filtered by role)
PATCH  /api/leads/:id/status         Update lead status
POST   /api/leads/:id/assign         Assign lead to agent
POST   /api/leads/:id/transfer       Transfer lead
POST   /api/leads/:id/notes          Add internal note

GET    /api/chats                    List chats (filtered by role)
GET    /api/chats/:id/messages       Get message history (paginated)
POST   /api/chats/:id/close          Close chat
POST   /api/chats/:id/reopen         Reopen chat

POST   /api/messages                 Send message
POST   /api/messages/media           Upload media

GET    /api/templates                List templates
POST   /api/templates                Create template (Manager+)
PATCH  /api/templates/:id            Update template
DELETE /api/templates/:id            Delete template

GET    /api/stickers                 List sticker packs
POST   /api/stickers/packs           Upload sticker pack (Admin)
PATCH  /api/stickers/packs/:id       Enable/disable pack

GET    /api/settings                 Get all settings
PATCH  /api/settings                 Update settings (Admin)

GET    /api/banners                  List banners
POST   /api/banners                  Create banner (Admin)
PATCH  /api/banners/:id              Update banner
DELETE /api/banners/:id              Delete banner

GET    /api/announcements            List announcements
POST   /api/announcements            Create announcement (Admin)

GET    /api/users/agents             List agents (Manager+)
POST   /api/users/agents             Create agent (Admin)
POST   /api/users/managers           Create manager (Admin)

GET    /api/analytics/overview       Dashboard stats
GET    /api/analytics/reports        Chart data

POST   /api/import                   Bulk import customers
GET    /api/export                   Export data (triggers background job)

GET    /api/notifications            Notification history
PATCH  /api/notifications/:id/read   Mark as read
```

### Socket.IO Events

```
CLIENT → SERVER:
  join_room          Join chat room
  send_message       Send a message
  typing_start       User started typing
  typing_stop        User stopped typing
  mark_read          Mark messages as read
  user_online        User connected
  user_offline       User disconnected

SERVER → CLIENT:
  new_message        New message received
  message_delivered  Message delivery confirmed
  message_read       Message read by recipient
  user_typing        Someone is typing
  user_status        Online/Offline status change
  notification       Real-time notification
  lead_assigned      Lead assigned to agent
  announcement       New announcement broadcast
```

---

## 9. Future Enhancements

The following are explicitly out of scope for v1.0 but planned for future versions:

| Feature | Description |
|---|---|
| AI Chatbot | Handle common questions automatically before escalating to agent |
| Smart Lead Routing | Assign leads based on agent workload and skill |
| CSAT Ratings | Customer satisfaction score after chat closes |
| Broadcast Messaging | Send mass messages to filtered customer segments |
| Scheduled Follow-ups | Set reminder to follow up with a customer at a specific time |
| Customer Timeline | Visual history of all interactions with a customer |
| Agent-to-Agent Chat | Internal team communication |
| Chat Labels | VIP, High Priority, New labels on chats |
| SLA Timers | Alert if response time exceeds SLA threshold |
| PWA | Installable on mobile home screen with push notifications |

---

## Appendix: Workflow Diagram

```
Customer clicks "Support"
         │
         ▼
Register (Name + Mobile + Password)
         │
         ▼
Password Hashed (bcrypt) + Account Created in MongoDB
         │
         ▼
JWT Issued (access + refresh)
         │
         ▼
Lead Auto-Created (status: New)
         │
         ▼
Assignment Queue (Redis)
         │
    ┌────┴────┐
    ▼         ▼
Auto       Manual
Assign     Assign
(Round     (Manager)
Robin)
    │         │
    └────┬────┘
         ▼
Agent Notified (Socket.IO)
         │
         ▼
Real-Time WebSocket Chat
         │
         ▼
Lead Status Updates:
In Progress → Follow-up → Interested → Converted → Closed
         │
         ▼
Full History Preserved in MongoDB
```

---

*Document Owner: DAFAX Bet Support Team*
*Version: 1.1 Final*
*Last Updated: June 2026*
