import { useState, useEffect } from "react"
import { supabase } from './supabase'
import AuthForm from './components/AuthForm'
import ThemeToggle from "./components/ThemeToggle"
import Page from "./components/Page"

// Runs once on first login if the user had data saved in localStorage.
// Creates a default page in Supabase and migrates all their old data into it.
async function migrateFromLocalStorage(userId, pageId) {
  const localTodos = (() => {
    try { return JSON.parse(localStorage.getItem('todos'))?.todos || [] } catch { return [] }
  })()
  const localCompleted = (() => {
    try { return JSON.parse(localStorage.getItem('completed'))?.completed || [] } catch { return [] }
  })()
  const localLists = (() => {
    try { return JSON.parse(localStorage.getItem('lists'))?.lists || [] } catch { return [] }
  })()

  if (localTodos.length > 0) {
    await supabase.from('todos').insert(
      localTodos.map((todo, i) => ({
        user_id: userId, page_id: pageId, list_id: null, text: todo.text, is_completed: false, position: i
      }))
    )
  }

  if (localCompleted.length > 0) {
    await supabase.from('todos').insert(
      localCompleted.map((todo, i) => ({
        user_id: userId, page_id: pageId, list_id: null, text: todo.text, is_completed: true, position: i
      }))
    )
  }

  for (const [listIndex, list] of localLists.entries()) {
    const { data: insertedList, error } = await supabase
      .from('lists')
      .insert({ user_id: userId, page_id: pageId, title: list.title, position: listIndex })
      .select()
      .single()

    if (error || !insertedList) continue

    if (list.todos?.length > 0) {
      await supabase.from('todos').insert(
        list.todos.map((todo, i) => ({
          user_id: userId, page_id: pageId, list_id: insertedList.id, text: todo.text, is_completed: false, position: i
        }))
      )
    }
  }

  localStorage.removeItem('todos')
  localStorage.removeItem('completed')
  localStorage.removeItem('lists')
}

const App = () => {
  // Auth state — who is logged in
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Pages state — the list of pages and which one is currently open
  const [pages, setPages] = useState([])
  const [activePage, setActivePage] = useState(null)

  // Theme is a UI preference so it stays in localStorage, not Supabase
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'dark' } catch { return 'dark' }
  })

  // Apply the theme to the whole document whenever it changes
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem('theme', theme)
    } catch (e) { }
  }, [theme])

  // Listen for login/logout events and keep user state in sync
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Once we know who the user is, load their pages from Supabase
  useEffect(() => {
    if (!user) return

    async function loadPages() {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .eq('user_id', user.id)
        .order('position')

      if (error) { console.error(error); return }

      // First ever login and they had localStorage data — migrate it into a new page
      const hasLocalData = localStorage.getItem('todos') || localStorage.getItem('lists')
      if (hasLocalData && data.length === 0) {
        const { data: newPage, error: pageError } = await supabase
          .from('pages')
          .insert({ user_id: user.id, title: 'My Page', position: 0 })
          .select()
          .single()

        if (pageError) { console.error(pageError); return }
        await migrateFromLocalStorage(user.id, newPage.id)
        window.location.reload()
        return
      }

      // No pages yet — could be a brand new user, or an existing user whose data
      // pre-dates the pages feature (their todos/lists have page_id = NULL).
      // Either way: create a default page, then assign any orphaned rows to it.
      if (data.length === 0) {
        const { data: newPage, error: pageError } = await supabase
          .from('pages')
          .insert({ user_id: user.id, title: 'My Page', position: 0 })
          .select()
          .single()

        if (pageError) { console.error(pageError); return }

        // Reassign any existing todos/lists that have page_id = NULL to the new page
        await supabase.from('todos').update({ page_id: newPage.id }).eq('user_id', user.id).is('page_id', null)
        await supabase.from('lists').update({ page_id: newPage.id }).eq('user_id', user.id).is('page_id', null)

        setPages([newPage])
        setActivePage(newPage)
        return
      }

      // Returning user — load their pages and open the first one
      setPages(data)
      setActivePage(data[0])
    }

    loadPages()
  }, [user])

  // Create a new empty page and switch to it
  async function handleAddPage() {
    if (pages.length >= 8) return

    const { data, error } = await supabase
      .from('pages')
      .insert({ user_id: user.id, title: 'New Page', position: pages.length })
      .select()
      .single()

    if (error) { console.error(error); return }
    setPages(prev => [...prev, data])
    setActivePage(data)
  }

  // Delete a page — but never let the user delete the last one
  async function handleDeletePage(id) {
    if (pages.length === 1) return
    const updated = pages.filter(p => p.id !== id)
    setPages(updated)
    if (activePage?.id === id) setActivePage(updated[0])
    await supabase.from('pages').delete().eq('id', id)
  }

  if (authLoading) return <div>Loading...</div>
  if (!user) return <AuthForm />

  return (
    <div className="App">
      <button className="signOutButton" onClick={() => supabase.auth.signOut()}>Sign out</button>
      <ThemeToggle theme={theme} setTheme={setTheme} />

      {/* Tab bar — one button per page, plus a button to create a new one */}
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
        <button className="page-tab" onClick={handleAddPage} disabled={pages.length >= 8}>+ New Page</button>
      </div>

      {/*
        key={activePage.id} is important — it tells React to fully destroy and
        recreate the Page component whenever you switch pages, so state resets
        and the new page's todos load fresh from Supabase.
      */}
      {activePage && <Page key={activePage.id} pageId={activePage.id} user={user} />}
    </div>
  )
}

export default App
