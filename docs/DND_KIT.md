# Drag-and-Drop: dnd-kit Implementation Guide

## What is dnd-kit?

`dnd-kit` is a modular drag-and-drop library for React. It handles the low-level complexity of pointer/touch events, accessibility, and transform calculations, and lets you define the drag logic yourself.

The three packages used in this app:

| Package | Purpose |
|---|---|
| `@dnd-kit/core` | Core drag context, sensors, and event system |
| `@dnd-kit/sortable` | Sortable list primitives (`useSortable`, `SortableContext`, `arrayMove`) |
| `@dnd-kit/utilities` | CSS transform helper (`CSS.Transform.toString`) |

---

## The Two Drag Types

This app supports **two completely different kinds of drag operations** happening inside the same `DndContext`:

| Type | What gets dragged | ID format | Example |
|---|---|---|---|
| `todo-item` | An individual task card | Numeric (e.g. `1710000000001`) | Moving "Buy milk" into a list |
| `list-section` | An entire list section block | Prefixed string (e.g. `list-section-42`) | Reordering "Uni" above "Work" |

They share the same drag event handlers but are routed through separate logic branches using the `isListSectionId()` utility:

```js
function isListSectionId(id) {
  return String(id).startsWith('list-section-')
}
```

When a drag starts, `activeDragType` is set to either `'list-section'` or `'todo-item'`. This flag is passed down to components that need to disable their own drag behavior while a list section is being moved (to prevent accidental todo drags during list reordering).

---

## Container ID System

The app defines virtual "containers" — buckets that own a set of todos. Each container has a string ID:

| Container | ID | Owns |
|---|---|---|
| Root inbox | `'root-todos'` | The top-level `todos` state array |
| List section | `'list-42'` (numeric suffix = list id) | That list's `todos` array |

The constant `ROOT_TODO_CONTAINER = 'root-todos'` is used throughout the drag logic to identify the top list.

**Why this matters:** When a todo is dragged, the app needs to know which container it came from and which container it's going into. The `findContainer(id)` function resolves this.

---

## Key Helper Functions

### `findContainer(id)`

Given any draggable ID (a todo id or container id), returns the container ID it belongs to.

```js
findContainer(todo.id)         // → 'root-todos' or 'list-42'
findContainer('root-todos')    // → 'root-todos'
findContainer('list-42')       // → 'list-42'
```

It checks in order:
1. Is it the `ROOT_TODO_CONTAINER` string itself? Return it.
2. Does it start with `'list-'`? It is already a container ID.
3. Is it a todo id found in the root `todos` array? Return `'root-todos'`.
4. Is it a todo id found inside any list? Return `'list-{id}'`.

### `getContainerItems(containerId)`

Returns the actual array of todos for a given container:

```js
getContainerItems('root-todos')  // → todos state array
getContainerItems('list-42')     // → lists.find(l => l.id === 42).todos
```

### `setItemsForContainer(containerId, nextItems, currentTodos, currentLists)`

Returns an updated `{ nextTodos, nextLists }` pair with the new item array applied to the right container. Does **not** call `setTodos`/`setLists` — it just produces new values for both state slices.

### `applyContainerState(nextTodos, nextLists)`

The final write step. Calls `setTodos`, `setLists`, `persistTodos`, and `persistLists` in one place.

---

## Sensors

Sensors define how a drag gets initiated (what physical action starts it):

```js
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } })
)
```

| Sensor | Trigger | Constraint | Why |
|---|---|---|---|
| `PointerSensor` | Mouse / stylus | Must move 8px before drag activates | Prevents accidental drags when clicking buttons |
| `TouchSensor` | Touchscreen | 250ms hold, 5px tolerance | Prevents interfering with normal touch scrolling |

Without `activationConstraint`, clicking the delete or edit button on a task would accidentally start a drag.

---

## Collision Detection

dnd-kit needs to know which droppable target the dragged item is "over." This app uses a **custom collision detection function** rather than a single built-in strategy:

```js
function listSectionCollisionDetection(args) {
  if (args.active && isListSectionId(args.active.id)) {
    const hits = pointerWithin(args).filter(({ id }) => isListSectionId(id))
    if (hits.length > 0) return hits
  }
  return closestCenter(args)
}
```

**How it works:**
- If the active (dragged) item is a **list section**, use `pointerWithin` and only consider other list sections as valid targets. This stops a list section from accidentally targeting a todo dropzone.
- For everything else (todo items), fall back to `closestCenter`, which picks the nearest droppable center point.

**Why two strategies?** List sections and todo dropzones overlap on screen. Without this filter, dragging a list section would sometimes snap to a todo's dropzone instead of another section.

---

## Drag Event Lifecycle

dnd-kit fires four events. Here is what each one does in this app:

### `onDragStart`

```
User picks up an item
→ setActiveDragId (the item's id)
→ setActiveDragType ('list-section' or 'todo-item')
```

These values are passed to `TodoCard` and `ListHeader` to apply the `.isDragging` CSS class and visual scale transform.

### `onDragOver` (fires continuously during drag)

Only relevant for **cross-container todo moves**. When a todo is dragged from one container to another:

1. Detect source container and destination container.
2. Remove the item from the source array.
3. Insert it into the destination array at the correct index.
4. Apply both changes atomically via `applyContainerState`.

This fires while dragging (not just on drop), which is what makes items visually "jump" into the target list as you hover — the state is actually updating in real time.

List section drags are **ignored here** (they are handled in `onDragEnd` instead):

```js
if (isListSectionId(active.id) || isListSectionId(over.id)) return
```

### `onDragEnd`

Fires once when the item is released. Three cases are handled:

| Case | What happens |
|---|---|
| List section dropped on list section | `arrayMove(lists, oldIndex, newIndex)` — reorders the lists array |
| Mixed (one is section, one is todo) | No-op, cancel |
| Todo dropped in same container | `arrayMove(containerItems, oldIndex, newIndex)` — reorders within container |
| Todo dropped in different container | Already handled live by `onDragOver`; `onDragEnd` detects containers differ and exits |

### `onDragCancel`

Fired if the drag is interrupted (e.g. pressing Escape). Clears `activeDragId` and `activeDragType`. State is already correct because `onDragOver` updates happened live — there is no "rollback" needed for todo moves. List reordering only commits in `onDragEnd`, so a cancel before drop means no change occurred.

---

## How Components Participate

### `TodoList` — the droppable zone

Uses `useDroppable` from `@dnd-kit/core` to register a container as a valid drop target:

```js
const { setNodeRef, isOver } = useDroppable({ id: containerId })
```

`isOver` is used to apply a highlight style when a draggable hovers over it.

Wraps children in `SortableContext` which tells dnd-kit the ordered list of item IDs for sorting calculations:

```js
<SortableContext items={todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
```

### `TodoCard` — the draggable todo

Uses `useSortable` which combines both draggable and droppable behavior:

```js
const { setNodeRef, attributes, listeners, transform, transition } = useSortable({ id })
```

- `attributes` and `listeners` are spread onto the drag handle (`<i className="fa-grip-lines">`) — this is what makes only the handle initiate a drag, not the whole card.
- `transform` and `transition` are applied as inline styles to animate the card's position during drag.

### `ListHeader` — the draggable list section

Also uses `useSortable` but with a prefixed sortable ID and a separate activator ref:

```js
const sortableId = `list-section-${id}`
const { setNodeRef, setActivatorNodeRef, attributes, listeners } = useSortable({
  id: sortableId,
  data: { type: 'list-section', listId: id }
})
```

`setActivatorNodeRef` is placed on the grip icon only — the rest of the list section (including its inner todo list) is not a drag handle. This prevents the inner `TodoList` from conflicting with the outer section drag.

---

## Summary: Drag Flow for a Cross-Container Todo Move

```
User grabs a todo card
  → onDragStart: activeDragId = todo.id, activeDragType = 'todo-item'

User hovers card over a different list
  → onDragOver fires repeatedly:
      findContainer(todo.id)     → 'root-todos'
      findContainer(over target) → 'list-42'
      containers differ → remove from root-todos, insert into list-42
      applyContainerState → setTodos + setLists + persist both

User releases
  → onDragEnd fires:
      containers differ → early return (move already applied by onDragOver)
      activeDragId = null, activeDragType = null
```
