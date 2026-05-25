# Pages Feature

## Overview

The pages feature lets a user have multiple independent workspaces — each called a "page" — where each page has its own set of todos and lists. Switching pages switches the entire workspace.

Before this feature, the whole app was one flat workspace per user. Now:

- `App.jsx` manages authentication, theme, the list of pages, and the session-wide completed list.
- `Page.jsx` manages everything inside a single page: todos, lists, and drag-and-drop.

---

## How It Works End to End

### 1. Login

When a user logs in, `App.jsx` fetches their pages from Supabase:

```js
supabase.from('pages').select('*').eq('user_id', user.id).order('position')
```

- If they have pages, the first one is set as active and rendered.
- If they have no pages (brand new user), a default "My Page" is created automatically and set as active.

### 2. Page navigation

`App.jsx` renders a tab bar using `PageTab` components, plus a "+ New Page" button:

```jsx
<div className="page-nav">
  {pages.map(page => (
    <PageTab
      key={page.id}
      page={page}
      isActive={activePage?.id === page.id}
      shouldAutoEdit={pendingRenamePageId === page.id}
      onAutoEditHandled={() => setPendingRenamePageId(null)}
      onSelect={setActivePage}
      onRename={handleUpdatePageTitle}
      onDelete={handleDeletePage}
      canDelete={pages.length > 1}
    />
  ))}
  {pages.length < 8 && (
    <button className="page-tab page-tab--add" onClick={handleAddPage}>+ New Page</button>
  )}
</div>
```

Clicking a tab calls `onSelect`, which updates `activePage` in `App.jsx` state and re-renders `<Page>` with the new `pageId`.

### 3. The `key` prop

```jsx
<Page key={activePage.id} pageId={activePage.id} user={user} />
```

The `key={activePage.id}` is important. When the key changes, React fully destroys the old `Page` component and creates a new one from scratch. This means:

- All the old todo/list state is cleared.
- The `useEffect` in `Page.jsx` runs again with the new `pageId`.
- Fresh data loads from Supabase for the new page.

Without `key`, React would reuse the same component instance and state from the old page would bleed into the new one.

### 4. Page.jsx loads scoped data

When `Page.jsx` mounts (or remounts due to a key change), its `useEffect` fetches only the data for that specific page:

```js
useEffect(() => {
  if (!pageId) return

  async function loadData() {
    const { data: listsData } = await supabase
      .from('lists')
      .select('*')
      .eq('page_id', pageId)   // ← only this page's lists
      .order('position')

    const { data: todosData } = await supabase
      .from('todos')
      .select('*')
      .eq('page_id', pageId)   // ← only this page's todos
      .order('position')

    // ... set state
  }

  loadData()
}, [pageId])
```

### 5. Writing data back

Every insert in `Page.jsx` includes `page_id: pageId` to stamp new data as belonging to this page:

```js
// Adding a todo
supabase.from('todos').insert({
  user_id: user.id,
  page_id: pageId,     // ← stamps it to this page
  list_id: null,
  text: newTodo,
  ...
})

// Adding a list
supabase.from('lists').insert({
  user_id: user.id,
  page_id: pageId,     // ← stamps it to this page
  title: 'New List',
  position: lists.length
})
```

---

## PageTab Component

`PageTab` (`src/components/PageTab.jsx`) is a presentational component that renders a single tab in the page nav bar. It owns only local UI state — all Supabase operations go through `App.jsx` callbacks.

**What it renders:**

- Default: a page title label, a pencil icon to enter rename mode, and (if `canDelete` is true) an X icon to delete the page.
- While renaming: a text input, and a save icon. Pressing Enter or clicking away also saves.

**Key props:**

| Prop | Description |
|---|---|
| `page` | The page object `{ id, title, ... }` |
| `isActive` | Adds the `.active` class to the tab |
| `shouldAutoEdit` | If true, the tab enters rename mode automatically on mount |
| `onAutoEditHandled` | Called after the auto-edit is triggered, so `App` clears `pendingRenamePageId` |
| `onSelect` | Called with the page object when the tab is clicked |
| `onRename` | Called with `(id, newTitle)` when a rename is saved |
| `onDelete` | Called with `id` when the X is clicked |
| `canDelete` | Hides the X button when there is only one page |

**Auto-edit flow:**

When a new page is created, `App.jsx` sets `pendingRenamePageId` to the new page's id. The matching `PageTab` receives `shouldAutoEdit={true}`, and on mount it enters rename mode automatically so the user can type a name immediately. Once triggered, it calls `onAutoEditHandled` to clear `pendingRenamePageId`.

---

## Database Schema

Three tables are involved:

**`pages`** — one row per page per user:

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Auto-generated unique ID |
| `user_id` | `uuid` | Which user owns this page |
| `title` | `text` | Page name shown in the tab bar |
| `position` | `integer` | Display order of tabs |
| `created_at` | `timestamptz` | When it was created |

**`lists`** — has `page_id`:

| Column | Type | Description |
|---|---|---|
| `page_id` | `uuid` (nullable FK) | Which page this list belongs to |
| *(all other columns unchanged)* | | |

**`todos`** — has `page_id`:

| Column | Type | Description |
|---|---|---|
| `page_id` | `uuid` (nullable FK) | Which page this todo belongs to |
| *(all other columns unchanged)* | | |

Both `page_id` foreign keys use `ON DELETE CASCADE` — deleting a page automatically deletes all its lists and todos.

SQL to add pages support to an existing schema:

```sql
CREATE TABLE pages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  title text NOT NULL DEFAULT 'My Page',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pages"
  ON pages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE todos ADD COLUMN page_id uuid REFERENCES pages(id) ON DELETE CASCADE;
ALTER TABLE lists ADD COLUMN page_id uuid REFERENCES pages(id) ON DELETE CASCADE;
```

---

## Responsibility Split

| Concern | Lives in |
|---|---|
| Auth (sign in/out, session) | `App.jsx` |
| Theme (dark/light) | `App.jsx` |
| Pages list, active page, create/rename/delete page | `App.jsx` |
| Completed todos (session-wide, across all pages) | `App.jsx` |
| Tab UI, local rename state, auto-edit trigger | `PageTab.jsx` |
| Todos state, lists state, drag-and-drop | `Page.jsx` |
| All Supabase calls for todos and lists | `Page.jsx` |

`Page.jsx` knows nothing about other pages or auth. It only knows its own `pageId` and the `user` object (needed for `user_id` on inserts).

---

## Creating, Renaming, and Deleting Pages

**Create:**

```js
async function handleAddPage() {
  if (pages.length >= 8) return

  const { data } = await supabase
    .from('pages')
    .insert({ user_id: user.id, title: 'New Page', position: pages.length })
    .select()
    .single()

  setPages(prev => [...prev, data])
  setActivePage(data)
  setPendingRenamePageId(data.id)  // triggers auto-edit in the new PageTab
}
```

**Rename:**

```js
async function handleUpdatePageTitle(id, newTitle) {
  setPages(prev => prev.map(p => p.id === id ? { ...p, title: newTitle } : p))
  if (activePage?.id === id) setActivePage(prev => ({ ...prev, title: newTitle }))
  await supabase.from('pages').update({ title: newTitle }).eq('id', id)
}
```

**Delete:**

```js
async function handleDeletePage(id) {
  if (pages.length === 1) return   // always keep at least one page

  const updated = pages.filter(p => p.id !== id)
  setPages(updated)
  if (activePage?.id === id) setActivePage(updated[0])   // switch away if active
  await supabase.from('pages').delete().eq('id', id)
  // ON DELETE CASCADE handles the todos and lists automatically
}
```

---

## Completed Todos: Cross-Page Ownership

Completed todos are owned by `App.jsx`, not `Page.jsx`. This means the completed list and session counter are visible regardless of which page is active.

When a todo is completed inside `Page.jsx`, it calls `setCompleted` (passed down as a prop from `App.jsx`) to add it to the shared list. When undoing a completed todo, `App.jsx` calls back into the active `Page.jsx` via `addTodoBackRef` to restore the todo to local state without a re-fetch — but only if the todo belongs to the currently active page.

---

## localStorage Migration

Users who had data saved in `localStorage` before the pages feature existed have their data migrated on first login. The migration:

1. Creates a default "My Page" in Supabase.
2. Reads todos, completed, and lists from `localStorage`.
3. Inserts all of them into Supabase with the new page's `page_id`.
4. Clears `localStorage`.
5. Reloads the page so the app starts fresh from Supabase.

See [SUPABASE.md](SUPABASE.md) for the full migration code.

---

## Further Reading

- [SUPABASE.md](SUPABASE.md) — Full Supabase setup, schema, auth, RLS, and CRUD patterns.
- [ARCHITECTURE.md](ARCHITECTURE.md) — Overall component structure and data flow.
