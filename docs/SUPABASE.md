# Implementing a Supabase Backend

## Overview

This guide walks through replacing the app's `localStorage` persistence with a Supabase backend. After completing it, each user will have a personal account, and their todos and lists will be stored in a cloud database instead of the browser.

**What changes:**
- Todos, lists, and completed items move from `localStorage` to Supabase tables.
- Users log in with an email and password before their data loads.
- On first login, any existing `localStorage` data is migrated to Supabase automatically.

**What stays the same:**
- No real-time sync needed — data loads once on startup and writes on each change, same as now.
- The React state shape in `App.jsx` stays identical. Supabase is only a persistence layer swap.

---

## 1. Supabase Project Setup

### Create a project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**, choose a name (e.g. `breads-task-list`), set a database password, and pick a region close to you.
3. Wait ~2 minutes for provisioning.

### Get your project credentials

In the Supabase dashboard, go to **Project Settings → API**. You need two values:

- **Project URL** — looks like `https://xyzxyz.supabase.co`
- **Anon (public) key** — a long string starting with `eyJ...`

These are safe to expose in client-side code. They allow the browser to call Supabase, but Row Level Security (covered in section 4) controls what data any user can actually access.

### Install the Supabase client

In your terminal, from the project root:

```bash
npm install @supabase/supabase-js
```

### Create an environment file

Create a `.env` file at the project root:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> Vite automatically exposes any variable prefixed with `VITE_` to your frontend code.

Make sure `.env` is in your `.gitignore` (it should already be, but double-check) so you don't accidentally commit your credentials.

### Create the Supabase client

Create a new file at `src/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

You'll import `supabase` from this file anywhere you need to talk to the database.

---

## 2. Database Schema

### What a schema is

A **schema** is the definition of your database tables — what tables exist, what columns they have, and what types of data each column stores. Think of it like designing a spreadsheet before you fill it in.

### The tables you need

This app needs two tables:

**`lists`** — stores named list sections (like "Uni Work" or "Errands"):

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique ID, auto-generated |
| `user_id` | `uuid` | Which user owns this list |
| `title` | `text` | The list name |
| `position` | `integer` | Display order |
| `created_at` | `timestamptz` | When it was created |

**`todos`** — stores every task (both root inbox tasks and tasks inside lists):

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique ID, auto-generated |
| `user_id` | `uuid` | Which user owns this todo |
| `list_id` | `uuid` (nullable) | The list it belongs to. `NULL` means it's in the root inbox |
| `text` | `text` | The task content |
| `is_completed` | `boolean` | Whether the task is done |
| `position` | `integer` | Display order within its container |
| `created_at` | `timestamptz` | When it was created |

> **Why one `todos` table instead of two?**  
> The current app has `todos[]` (active) and `completed[]` as separate arrays. In the database, it's cleaner to store them together with an `is_completed` flag. When loading data, you split them into their respective React state arrays by filtering.

> **Why `list_id` can be `NULL`?**  
> A todo with `list_id = NULL` lives in the root inbox. A todo with `list_id = <some-id>` belongs to that list. `NULL` is the database equivalent of "no parent."

### Create the tables

In the Supabase dashboard, go to **SQL Editor** and run this:

```sql
-- Lists table
CREATE TABLE lists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Todos table (covers root inbox AND list todos AND completed)
CREATE TABLE todos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

**What `ON DELETE CASCADE` means:**  
If a list is deleted, all todos belonging to that list are automatically deleted too. This mirrors the current app behavior.

**What `DEFAULT gen_random_uuid()` means:**  
Supabase auto-generates a UUID for `id` whenever a new row is inserted, so you never set it manually.

---

## 3. Authentication

### Enable email/password auth

In the Supabase dashboard: **Authentication → Providers → Email** — make sure it is enabled (it is by default). You can leave "Confirm email" off while developing so users don't need to verify.

### Auth flow

Supabase Auth works like this:

1. User signs up or logs in via the Supabase client.
2. Supabase returns a **session** containing a JWT token and user info.
3. All subsequent database calls automatically include that token, so Supabase knows who is making the request.
4. Row Level Security policies (section 4) use that identity to enforce data access.

### Wire up auth in App.jsx

Add this to `App.jsx` to track the current user:

```js
import { supabase } from './supabase'

// Inside the App component, add this state:
const [user, setUser] = useState(null)
const [authLoading, setAuthLoading] = useState(true)

// Add this useEffect alongside your existing startup useEffect:
useEffect(() => {
  // Check if a session already exists (e.g. returning user)
  supabase.auth.getSession().then(({ data: { session } }) => {
    setUser(session?.user ?? null)
    setAuthLoading(false)
  })

  // Listen for sign-in / sign-out events
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null)
  })

  return () => subscription.unsubscribe()
}, [])
```

### Create an AuthForm component

Create `src/components/AuthForm.jsx` to handle sign-up and login:

```jsx
import { useState } from 'react'
import { supabase } from '../supabase'

const AuthForm = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (error) setError(error.message)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>{isSignUp ? 'Create account' : 'Sign in'}</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <p className="authError">{error}</p>}
      <button type="submit">{isSignUp ? 'Sign up' : 'Sign in'}</button>
      <button type="button" onClick={() => setIsSignUp(!isSignUp)}>
        {isSignUp ? 'Already have an account? Sign in' : 'No account? Sign up'}
      </button>
    </form>
  )
}

export default AuthForm
```

### Gate the app behind auth

In `App.jsx`, wrap the return value to show `AuthForm` until the user is logged in:

```jsx
import AuthForm from './components/AuthForm'

// In the App component return:
if (authLoading) return <div>Loading...</div>
if (!user) return <AuthForm />

// ...rest of your existing return JSX
```

### Add a sign-out button

Somewhere in your UI (e.g. `SessionHeader`):

```jsx
<button onClick={() => supabase.auth.signOut()}>Sign out</button>
```

---

## 4. Row Level Security (RLS)

### What RLS is

Row Level Security is a Postgres feature that lets you attach rules to tables: "this user can only read/write rows where `user_id` matches their own ID." Without RLS, any logged-in user could theoretically read or write anyone else's data.

### Enable RLS on your tables

In the SQL Editor:

```sql
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
```

### Create policies

These policies say "a user can only see and modify their own rows":

```sql
-- Lists: users can only access their own lists
CREATE POLICY "Users manage own lists"
  ON lists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Todos: users can only access their own todos
CREATE POLICY "Users manage own todos"
  ON todos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**What `auth.uid()` is:** A Supabase function that returns the ID of the currently authenticated user making the request.

**`USING`** controls which rows can be read or targeted.  
**`WITH CHECK`** controls which rows can be written.

---

## 5. Replacing localStorage with Supabase

### ID format change

Currently the app generates IDs with `Date.now()` (a number). Supabase uses UUIDs (strings like `"a1b2c3d4-..."`). Anywhere you create a new todo or list, you can either:

- Let Supabase auto-generate the ID and read it back from the insert response.
- Generate a UUID in JS: install `uuid` (`npm install uuid`) and use `import { v4 as uuidv4 } from 'uuid'`.

The simplest approach is to let Supabase generate IDs and use the returned object to set state.

### Loading data on startup

Replace the `localStorage` reads in the startup `useEffect` with Supabase queries. A query is a request you send to the database asking for rows.

```js
useEffect(() => {
  if (!user) return

  async function loadData() {
    // Fetch all lists for this user, ordered by position
    const { data: listsData, error: listsError } = await supabase
      .from('lists')
      .select('*')
      .order('position')

    if (listsError) { console.error(listsError); return }

    // Fetch all todos for this user
    const { data: todosData, error: todosError } = await supabase
      .from('todos')
      .select('*')
      .order('position')

    if (todosError) { console.error(todosError); return }

    // Split todos into: root active, list active, completed
    const rootTodos = todosData.filter(t => !t.list_id && !t.is_completed)
    const completedTodos = todosData.filter(t => t.is_completed)

    // Attach todos to their lists
    const hydratedLists = listsData.map(list => ({
      ...list,
      todos: todosData.filter(t => t.list_id === list.id && !t.is_completed)
    }))

    setTodos(rootTodos)
    setCompleted(completedTodos)
    setLists(hydratedLists)
    setActiveListId(hydratedLists[0]?.id ?? null)
  }

  loadData()
}, [user]) // Re-runs when user changes (sign in / sign out)
```

> **Reading a query:**  
> `supabase.from('todos').select('*').order('position')` means:  
> "From the `todos` table, select all columns, ordered by the `position` column."

### Writing data — CRUD operations

Each `persist*` function in `App.jsx` needs to become a Supabase call.

**Add a todo:**

```js
async function handleAddTodos(newTodo) {
  const position = todos.length  // append at end

  const { data, error } = await supabase
    .from('todos')
    .insert({
      user_id: user.id,
      list_id: editingFromListId ?? null,
      text: newTodo,
      is_completed: false,
      position
    })
    .select()
    .single()  // returns the inserted row

  if (error) { console.error(error); return }

  const newTodoItem = data

  if (editingFromListId !== null) {
    setLists(lists.map(list =>
      list.id === editingFromListId
        ? { ...list, todos: [...list.todos, newTodoItem] }
        : list
    ))
    setEditingFromListId(null)
    return
  }

  setTodos([...todos, newTodoItem])
}
```

**Delete a todo:**

```js
async function handleDeleteTodo(index) {
  const todo = todos[index]
  const { error } = await supabase.from('todos').delete().eq('id', todo.id)
  if (error) { console.error(error); return }
  setTodos(todos.filter((_, i) => i !== index))
}
```

> **Reading `.eq('id', todo.id)`:** This is a filter — "where `id` equals `todo.id`." It's the SQL `WHERE id = ?` equivalent.

**Complete a todo:**

```js
async function handleCompleteTodo(index) {
  const todo = todos[index]
  const { error } = await supabase
    .from('todos')
    .update({ is_completed: true })
    .eq('id', todo.id)

  if (error) { console.error(error); return }

  setCompleted(prev => [...prev, { ...todo, is_completed: true }])
  setTodos(todos.filter((_, i) => i !== index))
}
```

**Undo completed:**

```js
async function handleUndoCompleted(index) {
  const todo = completed[index]
  const { error } = await supabase
    .from('todos')
    .update({ is_completed: false })
    .eq('id', todo.id)

  if (error) { console.error(error); return }

  setTodos([...todos, { ...todo, is_completed: false }])
  setCompleted(completed.filter((_, i) => i !== index))
}
```

**Reset session (clear all completed):**

```js
async function handleResetSession() {
  const completedIds = completed.map(t => t.id)
  const { error } = await supabase
    .from('todos')
    .delete()
    .in('id', completedIds)  // "WHERE id IN (...)"

  if (error) { console.error(error); return }
  setCompleted([])
}
```

**Add a list:**

```js
async function handleAddList() {
  const { data, error } = await supabase
    .from('lists')
    .insert({
      user_id: user.id,
      title: 'New List',
      position: lists.length
    })
    .select()
    .single()

  if (error) { console.error(error); return }

  const newList = { ...data, todos: [] }
  setLists([...lists, newList])
  setActiveListId(newList.id)
  setPendingRenameListId(newList.id)
}
```

**Delete a list:**

```js
async function handleDeleteList(id) {
  // Cascade in the database handles deleting the list's todos automatically
  const { error } = await supabase.from('lists').delete().eq('id', id)
  if (error) { console.error(error); return }

  const updatedLists = lists.filter(list => list.id !== id)
  setLists(updatedLists)
  if (activeListId === id) {
    setActiveListId(updatedLists[0]?.id ?? null)
  }
}
```

**Update a list title:**

```js
async function handleUpdateListTitle(id, newTitle) {
  const { error } = await supabase
    .from('lists')
    .update({ title: newTitle })
    .eq('id', id)

  if (error) { console.error(error); return }

  setLists(lists.map(list => list.id === id ? { ...list, title: newTitle } : list))
}
```

### Drag-and-drop reordering

When a drag ends, you need to update the `position` column for all reordered items. The simplest approach is to upsert the full reordered array:

```js
async function persistTodosOrder(orderedTodos) {
  const updates = orderedTodos.map((todo, index) => ({
    id: todo.id,
    user_id: user.id,
    list_id: todo.list_id ?? null,
    text: todo.text,
    is_completed: todo.is_completed,
    position: index
  }))

  const { error } = await supabase.from('todos').upsert(updates)
  if (error) console.error(error)
}
```

Call this at the end of `handleDragEnd` wherever you currently call `applyContainerState`.

---

## 6. First-Load Migration (localStorage → Supabase)

On the first time a user logs in, check if Supabase is empty but localStorage has data. If so, write the localStorage data to Supabase and then clear localStorage.

Add this inside the `loadData` function in your startup `useEffect`, before `setTodos`:

```js
const hasNoData = listsData.length === 0 && todosData.length === 0

if (hasNoData) {
  await migrateFromLocalStorage(user.id)
  // After migration, re-fetch (recurse or reload)
  window.location.reload()
  return
}
```

Then implement the migration function (outside the component, in a separate file or at the top of `App.jsx`):

```js
async function migrateFromLocalStorage(userId) {
  const rawTodos = localStorage.getItem('todos')
  const rawCompleted = localStorage.getItem('completed')
  const rawLists = localStorage.getItem('lists')

  const localTodos = rawTodos ? JSON.parse(rawTodos).todos || [] : []
  const localCompleted = rawCompleted ? JSON.parse(rawCompleted).completed || [] : []
  const localLists = rawLists ? JSON.parse(rawLists).lists || [] : []

  // Insert root todos
  if (localTodos.length > 0) {
    await supabase.from('todos').insert(
      localTodos.map((todo, index) => ({
        user_id: userId,
        list_id: null,
        text: todo.text,
        is_completed: false,
        position: index
      }))
    )
  }

  // Insert completed todos
  if (localCompleted.length > 0) {
    await supabase.from('todos').insert(
      localCompleted.map((todo, index) => ({
        user_id: userId,
        list_id: null,
        text: todo.text,
        is_completed: true,
        position: index
      }))
    )
  }

  // Insert lists and their todos
  for (const [listIndex, list] of localLists.entries()) {
    const { data: insertedList, error } = await supabase
      .from('lists')
      .insert({
        user_id: userId,
        title: list.title,
        position: listIndex
      })
      .select()
      .single()

    if (error || !insertedList) continue

    if (list.todos?.length > 0) {
      await supabase.from('todos').insert(
        list.todos.map((todo, index) => ({
          user_id: userId,
          list_id: insertedList.id,
          text: todo.text,
          is_completed: false,
          position: index
        }))
      )
    }
  }

  // Clear localStorage after successful migration
  localStorage.removeItem('todos')
  localStorage.removeItem('completed')
  localStorage.removeItem('lists')
}
```

> **Note:** The migration generates new UUIDs for all items (Supabase auto-generates them on insert). The old `Date.now()` IDs are not carried over — this is fine since they were only needed to keep React state consistent, and state is rebuilt from the database after migration.

---

## 7. Cleaning Up

Once Supabase is fully wired up:

- Remove all `persistTodos`, `persistCompleted`, and `persistLists` calls and their function definitions.
- Remove the `localStorage` reads from the startup `useEffect`.
- Remove `use-local-storage` from `package.json` (`npm uninstall use-local-storage`) — it's already unused.

---

## 8. Environment Variables for Deployment

When deploying (e.g. Vercel, Netlify), add the same two environment variables in your hosting provider's dashboard:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Your `.env` file only works locally — the build environment needs them set explicitly.

---

---

## 7. Pages Backend

The app now supports multiple pages — independent workspaces each with their own todos and lists. This required a new `pages` table and a `page_id` column on the existing `todos` and `lists` tables.

### New table: `pages`

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
```

### New columns on existing tables

```sql
ALTER TABLE todos ADD COLUMN page_id uuid REFERENCES pages(id) ON DELETE CASCADE;
ALTER TABLE lists ADD COLUMN page_id uuid REFERENCES pages(id) ON DELETE CASCADE;
```

`ON DELETE CASCADE` means if a page is deleted, all its todos and lists are automatically deleted too.

### How page_id scopes data

Every Supabase query in `Page.jsx` filters by `page_id` so each page only sees its own data:

```js
// Loading — only fetch todos that belong to this page
supabase.from('todos').select('*').eq('page_id', pageId).order('position')

// Inserting — stamp new todos with this page's ID
supabase.from('todos').insert({ user_id: user.id, page_id: pageId, text: newTodo, ... })
```

Without `page_id`, every page would show all of the user's todos.

### Loading pages on login

`App.jsx` fetches the user's pages after login and sets the first one as active. If the user has no pages yet (brand new account), it creates a default one automatically:

```js
async function loadPages() {
  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('user_id', user.id)
    .order('position')

  if (data.length === 0) {
    // New user — create a default page for them
    const { data: newPage } = await supabase
      .from('pages')
      .insert({ user_id: user.id, title: 'My Page', position: 0 })
      .select()
      .single()

    setPages([newPage])
    setActivePage(newPage)
    return
  }

  setPages(data)
  setActivePage(data[0])
}
```

### Creating and deleting pages

```js
// Create a new empty page and switch to it
async function handleAddPage() {
  const { data } = await supabase
    .from('pages')
    .insert({ user_id: user.id, title: 'New Page', position: pages.length })
    .select()
    .single()

  setPages(prev => [...prev, data])
  setActivePage(data)
}

// Delete a page — never delete the last one
async function handleDeletePage(id) {
  if (pages.length === 1) return
  const updated = pages.filter(p => p.id !== id)
  setPages(updated)
  if (activePage?.id === id) setActivePage(updated[0])
  await supabase.from('pages').delete().eq('id', id)
}
```

### Updated migration

`migrateFromLocalStorage` now takes a `pageId` and stamps all migrated data with it. A default page is created first, and its ID is passed into the migration:

```js
// In loadPages, before migrating:
const { data: newPage } = await supabase
  .from('pages')
  .insert({ user_id: user.id, title: 'My Page', position: 0 })
  .select()
  .single()

await migrateFromLocalStorage(user.id, newPage.id)

// In the migration function, every insert includes page_id:
{ user_id: userId, page_id: pageId, list_id: null, text: todo.text, ... }
```

---

## Summary of Files Changed

| File | Change |
|---|---|
| `.env` | New — holds Supabase URL and anon key |
| `src/supabase.js` | New — Supabase client singleton |
| `src/components/AuthForm.jsx` | New — sign-up / sign-in form |
| `src/App.jsx` | Replace all `localStorage` calls with Supabase; add user/auth state; add pages management; add migration |
| `src/components/Page.jsx` | New — owns all todo/list state and Supabase calls, scoped to a single page |
| `.gitignore` | Verify `.env` is listed |

---

## Further Reading

- [Supabase JavaScript client docs](https://supabase.com/docs/reference/javascript/introduction) — full API reference for `select`, `insert`, `update`, `delete`, `upsert`, and auth methods.
- [Supabase Auth guide](https://supabase.com/docs/guides/auth) — deeper auth options including OAuth (Google, GitHub, etc.).
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — more policy examples.
- [PAGES.md](PAGES.md) — How the multi-page feature works end to end.
