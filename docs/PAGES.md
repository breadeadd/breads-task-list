# Pages Feature

## Overview

The pages feature lets a user have multiple independent workspaces — each called a "page" — where each page has its own set of todos and lists. Switching pages switches the entire workspace.

Before this feature, the whole app was one flat workspace per user. Now:

- `App.jsx` manages authentication, theme, and the list of pages.
- `Page.jsx` manages everything inside a single page: todos, lists, drag-and-drop, completed tasks.

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

`App.jsx` renders a tab bar — one button per page plus a "+ New Page" button:

```jsx
<div className="page-nav">
  {pages.map(page => (
    <button
      key={page.id}
      className={activePage?.id === page.id ? 'page-tab active' : 'page-tab'}
      onClick={() => setActivePage(page)}
    >
      {page.title}
    </button>
  ))}
  <button className="page-tab" onClick={handleAddPage}>+ New Page</button>
</div>
```

Clicking a tab updates `activePage` in `App.jsx` state, which re-renders `<Page>` with the new `pageId`.

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

**`lists`** — now has `page_id`:

| Column | Type | Description |
|---|---|---|
| `page_id` | `uuid` (nullable FK) | Which page this list belongs to |
| *(all other columns unchanged)* | | |

**`todos`** — now has `page_id`:

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
| Pages list, active page, create/delete page | `App.jsx` |
| Todos state, lists state, drag-and-drop, completed | `Page.jsx` |
| All Supabase calls for todos and lists | `Page.jsx` |

`Page.jsx` knows nothing about other pages or auth. It only knows its own `pageId` and the `user` object (needed for `user_id` on inserts).

---

## Creating and Deleting Pages

**Create:**

```js
async function handleAddPage() {
  const { data } = await supabase
    .from('pages')
    .insert({ user_id: user.id, title: 'New Page', position: pages.length })
    .select()
    .single()

  setPages(prev => [...prev, data])
  setActivePage(data)   // immediately switch to the new page
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
