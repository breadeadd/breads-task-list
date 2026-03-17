# Bread's Task List: Technical Architecture Overview

## 1. Project Purpose

Bread's Task List is a single-page productivity app focused on fast task capture, lightweight organization, and short-term momentum tracking.

From the implementation, the app is designed around three practical goals:

- Capture tasks quickly in a global inbox.
- Organize tasks into custom list sections (for different contexts like school, work, errands).
- Track completed tasks in the current session, including undo and reset behavior.

The app intentionally avoids heavy planning features (deadlines, calendars, complex workflows). Its product strategy is low-friction input + visible progress.

## 2. Tech Stack and Dependencies

## Runtime and Build

- React 19: Component-based UI and state-driven rendering.
- React DOM 19: Browser rendering target for React.
- Vite: Fast development server and production build tooling.

Why this combination:

- Vite provides quick startup and hot module updates for frontend iteration.
- React provides predictable UI updates from state changes.

## Interaction and UX Libraries

- @dnd-kit/core
- @dnd-kit/sortable
- @dnd-kit/utilities

Why they are used:

- Implement drag-and-drop for both tasks and list sections.
- Support sorting within a container and moving tasks across containers.
- Provide transform utilities for smooth dragging animations.

## Persistence

- Browser localStorage (direct Web API usage).

Why it is used:

- Keeps app state between page refreshes with no backend.
- Supports the product promise that tasks/lists/session progress remain available later.

Note: The package use-local-storage exists in dependencies but is not used in the current source.

## Styling

- Plain CSS files (src/index.css and src/components/ThemeToggle.css).
- CSS custom properties (variables) for theming.
- Font Awesome loaded from CDN in index.html for iconography.
- Google Fonts (DM Mono) loaded from CDN in index.html.

Why this approach:

- Minimal setup and straightforward customization.
- Theme values can switch globally by changing data-theme.

## Code Quality Tooling

- ESLint with:
- @eslint/js
- eslint-plugin-react-hooks
- eslint-plugin-react-refresh
- globals

Purpose:

- Catch common JavaScript and React issues.
- Enforce hooks correctness and better dev ergonomics.

## 3. Architecture and Directory Structure

Top-level structure:

- src/main.jsx: React bootstrap and root render.
- src/App.jsx: Main orchestration component and state container.
- src/components: Presentational and interaction components.
- src/index.css: Global styling and theme tokens.
- docs/ARCHITECTURE.md: Architecture documentation.

How organization works in practice:

- Core business logic and application state are centralized in App.jsx.
- UI responsibilities are split into focused, reusable components in src/components.
- There is no hooks directory because custom hooks are not yet extracted; state logic remains in App.jsx.
- There is no router directory because the app is currently a single view with no multi-page navigation.

Component responsibility map:

- TodoInput: Captures new task text and submits actions to parent handlers.
- TodoList and TodoCard: Render and manage interactions for active tasks.
- ListsContainer and ListHeader: Manage custom list sections and nested list tasks.
- SessionHeader: Displays completed count and session reset action.
- CompletedList and CompletedCard: Show completed tasks and support undo.
- ThemeToggle: Toggles dark/light theme.

Architectural style:

- Container-presentational hybrid.
- App.jsx behaves as the container (state + logic).
- Most components are presentation-first and receive callbacks/values as props.

## 4. Key Data Flow and Source of Truth

## Source of Truth

The primary source of truth is React state in App.jsx.

Core state slices:

- todos: Active tasks in the root inbox.
- lists: Array of list objects, each with title and nested todos.
- completed: Tasks finished in current session.
- todoValue: Current input text.
- theme: Active visual mode.
- Additional UI state for drag context and inline editing.

## Data Flow Direction

Data follows a top-down flow:

1. App.jsx owns state.
2. App.jsx passes values and handlers to child components via props.
3. Child components trigger callbacks (add, edit, delete, complete, reorder).
4. App.jsx updates state immutably.
5. Updated state re-renders the UI.

Persistence flow:

- On startup, useEffect reads localStorage and hydrates todos, completed, and lists.
- On each relevant action, helper functions persistTodos, persistCompleted, and persistLists serialize updated arrays back to localStorage.

Drag-and-drop flow:

- DndContext is declared in App.jsx.
- Drag events are handled in App.jsx (start, over, end, cancel).
- Utility functions resolve container ownership and compute immutable reorder/move operations.
- Final results are written to state and localStorage.

## Important architecture concept in this app

Prop drilling:

- Prop drilling means passing data and callbacks through several component layers.
- This app uses prop drilling heavily from App.jsx to deep children.
- This is acceptable at current size, but can become hard to maintain as complexity grows.

Context API (not currently used):

- React Context lets shared state and actions be consumed without manually passing props through every level.
- If this app grows significantly, Context (or another state library) could reduce prop-chain complexity.

## 5. Entry Points and Runtime Boot Sequence

Primary entry points:

- index.html: Hosts root div, global font/icon includes, and loads src/main.jsx.
- src/main.jsx: Creates React root and renders App within StrictMode.
- src/App.jsx: Main application runtime (state, effects, drag logic, persistence, component composition).

Current routing/provider status:

- No React Router is configured.
- No global provider architecture is configured (for example Context Provider, Redux Provider, or query provider).
- App-level state is therefore the runtime hub.

## 6. Practical Beginner Notes

- If you need to change app behavior, start with App.jsx first; most core logic lives there.
- If you need to change look and layout, use src/index.css and component-specific CSS.
- If you need to add a new feature that shares data across many components, consider introducing Context to reduce prop drilling.
- If you need multi-page behavior, introduce a router and move page-level concerns into dedicated modules.

## 7. Suggested Evolution Path

Reasonable next architecture steps:

1. Extract reusable logic from App.jsx into custom hooks (for example useTodos, useLists, useSession, useTheme).
2. Add a small data-layer utility for localStorage to centralize parsing/serialization and error handling.
3. Introduce Context when prop drilling starts reducing maintainability.
4. Add tests for state transitions (add/edit/delete/complete/drag operations).

This keeps the current beginner-friendly structure while improving scalability and maintainability over time.

---

## Further Reading

Detailed deep-dives are available for the two most complex areas of the codebase:

- [DATA_MODEL.md](DATA_MODEL.md) — Object shapes, nested list/todo structure, immutable update patterns, localStorage serialization format.
- [DND_KIT.md](DND_KIT.md) — How dnd-kit is used in this app: the two drag types, container ID system, collision detection, sensor configuration, and a step-by-step walkthrough of every drag event handler.
