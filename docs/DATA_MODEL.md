# Data Model and State Structure

## Overview

Understanding the shape of your data is the foundation for understanding everything else in this app. All state lives in `App.jsx`, and the two most important structures are the **todo object** and the **list object**.

---

## Core Object Shapes

### Todo Object

Every task — whether it lives in the root inbox or inside a list — is the same shape:

```js
{
  id: 1710000000000,  // Date.now() at creation time — a unique timestamp number
  text: "Buy groceries"
}
```

- `id` is used to identify the item during drag-and-drop, editing, and deletion.
- `text` is the raw string the user typed.

### List Object

A list section is an object that has its own `todos` array nested inside it:

```js
{
  id: 1710000000001,   // Date.now() at creation time
  title: "Uni Work",
  todos: [
    { id: 1710000000002, text: "Read chapter 4" },
    { id: 1710000000003, text: "Submit essay" }
  ]
}
```

This is the "nested state" the README refers to. A list contains tasks, and both have their own ids.

---

## The Two-Tier Todo Structure

The app has two places where todos can live:

```
App state
├── todos[]          ← Root inbox (the main list at the top)
└── lists[]
    ├── list { id, title, todos[] }   ← Belongs to "Uni Work"
    └── list { id, title, todos[] }   ← Belongs to "Work"
```

When a user adds a task without a list selected, it goes into `todos`. When a list section is targeted (`editingFromListId` is set), it goes into that list's `todos` array instead.

---

## Why IDs Use `Date.now()`

```js
const newTodoItem = {
  id: Date.now(),
  text: newTodo
}
```

`Date.now()` returns the number of milliseconds since January 1, 1970. Since tasks are added one at a time by a human, the timestamp is always unique enough. This avoids needing a library like `uuid`. The tradeoff is that these IDs are not collision-safe if items were created programmatically at the same millisecond (not a concern here).

---

## Immutable State Updates

React requires you to **never directly mutate state**. Instead, you always create a new copy with your change applied. This tells React that something changed and it needs to re-render.

### Wrong (mutation):
```js
todos[0].text = "New text"  // React won't notice this change
setTodos(todos)
```

### Correct (immutable copy):
```js
const updated = todos.map((todo, i) =>
  i === 0 ? { ...todo, text: "New text" } : todo
)
setTodos(updated)
```

The spread operator `{ ...todo }` creates a shallow copy of the object, then the new property overwrites the old one.

### Three levels deep

Updating a todo inside a list requires replacing the todo, then replacing the list, then replacing the lists array:

```js
const updatedLists = lists.map((list) =>
  list.id === listId
    ? { ...list, todos: list.todos.filter((_, i) => i !== index) }
    : list
)
setLists(updatedLists)
```

Breaking this down:
1. `lists.map(...)` creates a new array.
2. For the matching list, `{ ...list, todos: ... }` creates a new list object with updated todos.
3. All other lists are returned unchanged.

---

## State Slices Reference

| Variable | Type | Purpose |
|---|---|---|
| `todos` | `Array<{id, text}>` | Active tasks in the root inbox |
| `lists` | `Array<{id, title, todos[]}>` | Named list sections with their own tasks |
| `completed` | `Array<{id, text}>` | Tasks completed this session |
| `todoValue` | `string` | Live text in the input field |
| `theme` | `'dark' \| 'light'` | Current visual mode |
| `activeListId` | `number \| null` | Which list section is selected |
| `editingFromListId` | `number \| null` | Tracks if input is targeting a list |
| `pendingRenameListId` | `number \| null` | Triggers auto-focus rename on new lists |
| `activeDragId` | `number \| string \| null` | ID of the item currently being dragged |
| `activeDragType` | `'todo-item' \| 'list-section' \| null` | Category of the active drag |

---

## localStorage Serialization

Each state slice is stored under its own key as a JSON string:

| Key | Stored value shape |
|---|---|
| `'todos'` | `{ todos: [{id, text}, ...] }` |
| `'completed'` | `{ completed: [{id, text}, ...] }` |
| `'lists'` | `{ lists: [{id, title, todos: [{id, text}]}, ...] }` |
| `'theme'` | `'dark'` or `'light'` (plain string, not JSON) |

Writing:
```js
localStorage.setItem('todos', JSON.stringify({ todos: newList }))
```

Reading (on app startup inside `useEffect`):
```js
const raw = localStorage.getItem('todos')
const parsed = JSON.parse(raw).todos || []
setTodos(parsed)
```

### Legacy format handling

The startup `useEffect` checks whether a stored todo is a plain string or an object. This handles data saved by an older version of the app that stored strings directly:

```js
.map((todo, index) => {
  if (typeof todo === 'string') {
    return { id: Date.now() + index, text: todo }  // upgrade old format
  }
  return todo  // already the new format
})
```

---

## Session vs. Persistent Data

| Data | Persists across page refresh? | Notes |
|---|---|---|
| `todos` | Yes | Saved to localStorage on every change |
| `lists` | Yes | Saved to localStorage on every change |
| `completed` | Yes | Saved, but can be cleared with Reset Session |
| `theme` | Yes | Saved to localStorage |
| `todoValue` | No | In-memory only, just the current input string |
| `activeListId` | No | Rehydrated from first list on startup |
| UI state (drag, rename) | No | Transient interaction state |

`completed` is intentionally designed to feel "session-like" (reset button, session counter) but it does persist so you don't lose progress on a refresh.
