import { useState, useEffect, useRef } from "react"
import { supabase } from './supabase'
import AuthForm from './components/AuthForm'
import ThemeToggle from "./components/ThemeToggle"
import Page from "./components/Page"
import PageTab from "./components/PageTab"
import SessionHeader from "./components/SessionHeader"
import CompletedList from "./components/CompletedList"

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
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [pages, setPages] = useState([])
  const [activePage, setActivePage] = useState(null)
  const [pendingRenamePageId, setPendingRenamePageId] = useState(null)

  // completed lives here so SessionHeader and CompletedList can live here too
  const [completed, setCompleted] = useState([])
  const sessionCount = completed.length

  // Page.jsx sets this ref so handleUndoCompleted can add the todo back into
  // Page's local todos state without needing to re-fetch from Supabase
  const addTodoBackRef = useRef(null)

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'dark' } catch { return 'dark' }
  })

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem('theme', theme)
    } catch (e) { }
  }, [theme])

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

  useEffect(() => {
    if (!user) return

    async function loadPages() {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .eq('user_id', user.id)
        .order('position')

      if (error) { console.error(error); return }

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

      if (data.length === 0) {
        const { data: newPage, error: pageError } = await supabase
          .from('pages')
          .insert({ user_id: user.id, title: 'My Page', position: 0 })
          .select()
          .single()

        if (pageError) { console.error(pageError); return }

        await supabase.from('todos').update({ page_id: newPage.id }).eq('user_id', user.id).is('page_id', null)
        await supabase.from('lists').update({ page_id: newPage.id }).eq('user_id', user.id).is('page_id', null)

        setPages([newPage])
        setActivePage(newPage)
        return
      }

      setPages(data)
      setActivePage(data[0])
    }

    // Load ALL completed todos for this user across every page — completed is
    // a session-wide list, not scoped to the active page
    async function loadCompleted() {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', true)
        .order('created_at')

      if (error) { console.error(error); return }
      setCompleted(data)
    }

    loadPages()
    loadCompleted()
  }, [user])

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
    setPendingRenamePageId(data.id)
  }

  async function handleDeletePage(id) {
    if (pages.length === 1) return
    const updated = pages.filter(p => p.id !== id)
    setPages(updated)
    if (activePage?.id === id) setActivePage(updated[0])
    await supabase.from('pages').delete().eq('id', id)
  }

  async function handleUpdatePageTitle(id, newTitle) {
    setPages(prev => prev.map(p => p.id === id ? { ...p, title: newTitle } : p))
    if (activePage?.id === id) setActivePage(prev => ({ ...prev, title: newTitle }))
    await supabase.from('pages').update({ title: newTitle }).eq('id', id)
  }

  async function handleResetSession() {
    const completedIds = completed.map(t => t.id)
    setCompleted([])
    if (completedIds.length > 0) {
      await supabase.from('todos').delete().in('id', completedIds)
    }
  }

  async function handleUndoCompleted(index) {
    const todo = completed[index]
    setCompleted(prev => prev.filter((_, i) => i !== index))
    // Only update Page's local state if the todo belongs to the currently open page.
    // If it's from another page, Supabase is updated and it'll appear when navigating there.
    if (todo.page_id === activePage?.id) {
      addTodoBackRef.current?.(todo)
    }
    await supabase.from('todos').update({ is_completed: false }).eq('id', todo.id)
  }

  if (authLoading) return <div>Loading...</div>
  if (!user) return <AuthForm />

  return (
    <div className="App">
      <button className="signOutButton" onClick={() => supabase.auth.signOut()}>Sign out</button>
      <ThemeToggle theme={theme} setTheme={setTheme} />

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

      {activePage && (
        <Page
          key={activePage.id}
          pageId={activePage.id}
          user={user}
          setCompleted={setCompleted}
          addTodoBackRef={addTodoBackRef}
        />
      )}

      <SessionHeader count={sessionCount} handleResetSession={handleResetSession} />
      <CompletedList todos={completed} handleUndoCompleted={handleUndoCompleted} />
    </div>
  )
}

export default App
