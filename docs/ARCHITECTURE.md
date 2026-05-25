# Bread's Task List: Technical Architecture Overview

## 1. Project Purpose

Bread's Task List is a single-page productivity app focused on fast task capture, lightweight organization, and short-term momentum tracking.

From the implementation, the app is designed around three practical goals:

- Capture tasks quickly in a global inbox.
- Organize tasks into custom list sections (for different contexts like school, work, errands).
- Track completed tasks in the current session, including undo and reset behavior.

The app intentionally avoids heavy planning features (deadlines, calendars, complex workflows). Its product strategy is low-friction input + visible progress.

---

## 2. Tech Stack and Dependencies

### Runtime and Build

- React 19: Component-based UI and state-driven rendering.
- React DOM 19: Browser rendering target for React.
- Vite: Fast development server and production build tooling.

Why this combination:

- Vite provides quick startup and hot module updates for frontend iteration.
- React provides predictable UI updates from state changes.

### Interaction and UX Libraries

- @dnd-kit/core
- @dnd-kit/sortable
- @dnd-kit/utilities

Why they are used:

- Implement drag-and-drop for both tasks and list sections.
- Support sorting within a container and moving tasks across containers.
- Provide transform utilities for smooth dragging animations.

### Persistence

- Supabase (cloud Postgres database + auth).

Why it is used:

- Persists todos, lists, and pages to a real database so data is available across devices and sessions.
- Built-in auth handles user accounts (sign up, sign in, sign out) without a custom backend.
- Row Level Security ensures users can only access their own data.

> **Previously:** The app used `localStorage` for persistence with no user accounts. On first login, any existing `localStorage` data is automatically migrated to Supabase. See [SUPABASE.md](SUPABASE.md) for details.

### Styling

- Plain CSS files (`src/index.css` and `src/components/ThemeToggle.css`).
- CSS custom properties (variables) for theming.
- Font Awesome loaded from CDN in `index.html` for iconography.
- Google Fonts (DM Mono) loaded from CDN in `index.html`.

Why this approach:

- Minimal setup and straightforward customization.
- Theme values can switch globally by changing `data-theme`.

### Code Quality Tooling

- ESLint with:
  - @eslint/js
  - eslint-plugin-react-hooks
  - eslint-plugin-react-refresh
  - globals

Purpose:

- Catch common JavaScript and React issues.
- Enforce hooks correctness and better dev ergonomics.

---

## 3. Architecture and Directory Structure

Top-level structure:

- `src/main.jsx` — React bootstrap and root render.
- `src/App.jsx` — Auth, theme, and pages management. Renders `<Page>`.
- `src/supabase.js` — Supabase client singleton.
- `src/components/` — All UI and logic components.
- `src/index.css` — Global styling and theme tokens.
- `docs/` — Architecture and feature documentation.

### How the two-layer structure works

The app is split into two distinct layers of responsibility:

**`App.jsx` — the shell**

Owns: authentication state, theme, the list of pages, which page is active, and page CRUD (create/delete). Renders the page tab bar and a single `<Page>` component for whichever page is active.

**`Page.jsx` — the workspace**

Owns: all todo and list state, all drag-and-drop logic, all Supabase reads/writes for todos and lists. Receives `pageId` and `user` as props from `App.jsx`. Knows nothing about other pages or auth.

This split exists so that switching pages fully resets the workspace state — React destroys and recreates `Page` when the `key` prop changes (see [PAGES.md](PAGES.md)).

### Component responsibility map

| Component | Responsibility |
|---|---|
| `App.jsx` | Auth, theme, pages list, active page, renders `<Page>` |
| `Page.jsx` | All todo/list state, DnD logic, Supabase calls for todos/lists |
| `AuthForm` | Sign-up and sign-in form |
| `TodoInput` | Captures new task text and submits to parent handlers |
| `TodoList` + `TodoCard` | Render and manage interactions for active tasks |
| `ListsContainer` + `ListHeader` | Manage custom list sections and nested list tasks |
| `SessionHeader` | Displays completed count and session reset action |
| `CompletedList` + `CompletedCard` | Show completed tasks and support undo |
| `ThemeToggle` | Toggles dark/light theme |

### Architectural style

- Container-presentational hybrid.
- `App.jsx` is a thin shell container (auth + pages).
- `Page.jsx` is the main container (todos/lists state + logic).
- Most other components are presentation-first and receive callbacks/values as props.

---

## 4. Key Data Flow and Source of Truth

### Source of Truth

The primary source of truth is Supabase. React state in `App.jsx` and `Page.jsx` is a local cache of what is in the database.

**`App.jsx` state:**

- `user` — the currently authenticated user object.
- `authLoading` — whether the initial auth check is still in progress.
- `pages` — array of the user's pages.
- `activePage` — the currently selected page.
- `theme` — active visual mode (stored in `localStorage`, not Supabase).

**`Page.jsx` state (scoped to one page):**

- `todos` — active tasks in the root inbox for this page.
- `lists` — named list sections with their nested todos, for this page.
- `completed` — tasks completed this session.
- `todoValue` — current text in the input field.
- Additional UI state for drag context and inline editing.

### Data Flow Direction

Data follows a top-down flow:

1. `App.jsx` owns auth + pages state. Passes `pageId` and `user` down to `Page.jsx`.
2. `Page.jsx` owns todo/list state. Passes values and handlers to child components via props.
3. Child components trigger callbacks (add, edit, delete, complete, reorder).
4. `Page.jsx` updates state immutably and writes to Supabase.

### Persistence Flow

On login:
- `App.jsx` fetches the user's pages from Supabase.
- The active `pageId` is passed to `<Page>`.
- `Page.jsx` fetches todos and lists filtered by `page_id`.

On each write:
- `Page.jsx` updates local state immediately (optimistic update).
- Then writes the change to Supabase in the background.

### Drag-and-drop Flow

- `DndContext` is declared in `Page.jsx`.
- Drag events are handled in `Page.jsx` (start, over, end, cancel).
- Utility functions resolve container ownership and compute immutable reorder/move operations.
- Final results are written to state and persisted to Supabase via `upsert`.

### Important Architecture Concept: Prop Drilling

Prop drilling means passing data and callbacks through several component layers. This app uses prop drilling from `Page.jsx` to deep children. This is acceptable at the current size but can become hard to maintain as complexity grows.

React Context (not currently used) would let shared state and actions be consumed without manually passing props through every level. If this app grows significantly, Context could reduce prop-chain complexity.

---

## 5. Entry Points and Runtime Boot Sequence

Primary entry points:

- `index.html` — Hosts root div, global font/icon includes, and loads `src/main.jsx`.
- `src/main.jsx` — Creates React root and renders `App` within `StrictMode`.
- `src/App.jsx` — Checks auth session, loads pages, renders shell UI and `<Page>`.
- `src/components/Page.jsx` — Loads page-specific todos/lists, renders full workspace.

Boot sequence:

1. `App` mounts — auth check begins (`authLoading = true`), shows loading state.
2. Auth resolves — `user` is set (or null). If null, `AuthForm` is shown.
3. On login — `loadPages` runs, fetches user's pages from Supabase.
4. `activePage` is set — `<Page key={activePage.id} pageId={...}>` renders.
5. `Page` mounts — `loadData` runs, fetches todos and lists for that `pageId`.
6. UI is ready.

Current routing/provider status:

- No React Router is configured.
- No global provider architecture is configured (Context Provider, Redux, etc.).
- App-level state is the runtime hub for auth and pages; Page-level state handles todos/lists.

---

## 6. Practical Notes

- To change how todos or lists behave, start in `Page.jsx` — that's where all the todo/list logic lives now.
- To change auth, pages, or theme behavior, look in `App.jsx`.
- To change look and layout, use `src/index.css` and component-specific CSS.
- If you need a new feature that shares data across many components, consider introducing Context to reduce prop drilling.
- The `key={activePage.id}` on `<Page>` in `App.jsx` is intentional — removing it would cause state from one page to bleed into another when switching tabs.

---

## 7. Suggested Evolution Path

Reasonable next architecture steps:

1. Extract reusable logic from `Page.jsx` into custom hooks (for example `useTodos`, `useLists`, `useSession`).
2. Add page title editing — an inline rename input in the tab bar, similar to how list titles are renamed.
3. Introduce Context when prop drilling starts reducing maintainability.
4. Add tests for state transitions (add/edit/delete/complete/drag operations).

---

## Further Reading

Detailed deep-dives are available for specific areas of the codebase:

- [SUPABASE.md](SUPABASE.md) — Full Supabase setup: schema, auth, RLS, CRUD patterns, and the pages backend.
- [PAGES.md](PAGES.md) — How the multi-page feature works end to end: database schema, data flow, and the key prop explained.
- [DATA_MODEL.md](DATA_MODEL.md) — Object shapes, nested list/todo structure, and immutable update patterns.
- [DND_KIT.md](DND_KIT.md) — How dnd-kit is used: the two drag types, container ID system, collision detection, sensor configuration, and a step-by-step walkthrough of every drag event handler.
