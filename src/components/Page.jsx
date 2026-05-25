import { useState, useEffect, useRef } from "react"
import { DndContext, closestCenter, pointerWithin, useSensor, useSensors, PointerSensor, TouchSensor } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { supabase } from '../supabase'
import TodoInput from "./TodoInput"
import TodoList from "./TodoList"
import ListsContainer from "./ListsContainer"

// Note: '../supabase' goes up one folder because Page.jsx is inside /components

const ROOT_TODO_CONTAINER = 'root-todos'

// These helpers are the same as before — they live here now because
// Page.jsx owns all the drag-and-drop logic.
function listSectionCollisionDetection(args) {
  if (args.active && isListSectionId(args.active.id)) {
    const hits = pointerWithin(args).filter(({ id }) => isListSectionId(id))
    if (hits.length > 0) return hits
  }
  return closestCenter(args)
}

function isListSectionId(id) {
  return String(id).startsWith('list-section-')
}

function parseListIdFromSectionId(id) {
  return String(id).replace('list-section-', '')
}

// Page receives pageId, user, setCompleted (owned by App), and addTodoBackRef
// (a ref App uses to call back into Page when undoing a completed todo).
const Page = ({ pageId, user, setCompleted, addTodoBackRef }) => {
  const [todos, setTodos] = useState([])
  const [todoValue, setTodoValue] = useState('')
  const [lists, setLists] = useState([])
  const [activeListId, setActiveListId] = useState(null)
  const [pendingRenameListId, setPendingRenameListId] = useState(null)
  const [editingFromListId, setEditingFromListId] = useState(null)
  const [activeDragId, setActiveDragId] = useState(null)
  const [activeDragType, setActiveDragType] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )
  const todoInputRef = useRef(null)

  // Register the addTodoBack function so App.jsx can call it from handleUndoCompleted.
  // This lets undo update Page's local todos state instantly without a Supabase re-fetch.
  useEffect(() => {
    if (addTodoBackRef) {
      addTodoBackRef.current = (todo) => {
        setTodos(prev => [...prev, { ...todo, is_completed: false }])
      }
    }
    return () => {
      if (addTodoBackRef) addTodoBackRef.current = null
    }
  }, [])

  // Load this page's todos and lists from Supabase whenever pageId changes.
  // The .eq('page_id', pageId) filter is what scopes data to this specific page —
  // without it every page would show all the user's todos.
  useEffect(() => {
    if (!pageId) return

    async function loadData() {
      const { data: listsData, error: listsError } = await supabase
        .from('lists')
        .select('*')
        .eq('page_id', pageId)
        .order('position')

      if (listsError) { console.error(listsError); return }

      const { data: todosData, error: todosError } = await supabase
        .from('todos')
        .select('*')
        .eq('page_id', pageId)
        .order('position')

      if (todosError) { console.error(todosError); return }

      const rootTodos = todosData.filter(t => !t.list_id && !t.is_completed)
      const hydratedLists = listsData.map(list => ({
        ...list,
        todos: todosData.filter(t => t.list_id === list.id && !t.is_completed)
      }))

      setTodos(rootTodos)
      setLists(hydratedLists)
      setActiveListId(hydratedLists[0]?.id ?? null)
    }

    loadData()
  }, [pageId])

  function focusTodoInput() {
    if (!todoInputRef.current) return
    requestAnimationFrame(() => {
      const input = todoInputRef.current
      input.focus()
      const end = input.value.length
      input.setSelectionRange(end, end)
    })
  }

  // Every insert now includes page_id: pageId so the todo belongs to this page.
  // Without this, todos would save to Supabase but not be tied to any page.
  async function handleAddTodos(newTodo) {
    const targetListId = editingFromListId
    const position = targetListId
      ? (lists.find(l => l.id === targetListId)?.todos.length ?? 0)
      : todos.length

    const { data, error } = await supabase
      .from('todos')
      .insert({
        user_id: user.id,
        page_id: pageId,
        list_id: targetListId ?? null,
        text: newTodo,
        is_completed: false,
        position
      })
      .select()
      .single()

    if (error) { console.error(error); return }

    if (targetListId !== null) {
      if (lists.some(list => list.id === targetListId)) {
        setLists(prev => prev.map(list =>
          list.id === targetListId
            ? { ...list, todos: [...list.todos, data] }
            : list
        ))
        setEditingFromListId(null)
        return
      }
      setEditingFromListId(null)
    }

    setTodos(prev => [...prev, data])
  }

  async function handleDeleteTodo(index) {
    const todo = todos[index]
    setTodos(prev => prev.filter((_, i) => i !== index))
    await supabase.from('todos').delete().eq('id', todo.id)
  }

  function handleEditTodo(index) {
    const valueToBeEdited = todos[index]
    setTodoValue(valueToBeEdited.text)
    setEditingFromListId(null)
    handleDeleteTodo(index)
    focusTodoInput()
  }

  async function handleCompleteTodo(index) {
    const todo = todos[index]
    setTodos(prev => prev.filter((_, i) => i !== index))
    setCompleted(prev => [...prev, { ...todo, is_completed: true }])
    await supabase.from('todos').update({ is_completed: true }).eq('id', todo.id)
  }

  async function handleDeleteListTodo(listId, index) {
    const listToUpdate = lists.find(list => list.id === listId)
    if (!listToUpdate) return
    const todo = listToUpdate.todos[index]
    if (!todo) return

    setLists(prev => prev.map(list =>
      list.id === listId
        ? { ...list, todos: list.todos.filter((_, i) => i !== index) }
        : list
    ))
    await supabase.from('todos').delete().eq('id', todo.id)
  }

  function handleEditListTodo(listId, index) {
    const listToEdit = lists.find(list => list.id === listId)
    if (!listToEdit) return

    const valueToBeEdited = listToEdit.todos[index]
    if (!valueToBeEdited) return

    setTodoValue(valueToBeEdited.text)
    setEditingFromListId(listId)
    handleDeleteListTodo(listId, index)
    focusTodoInput()
  }

  async function handleCompleteListTodo(listId, index) {
    const listToUpdate = lists.find(list => list.id === listId)
    if (!listToUpdate) return

    const todo = listToUpdate.todos[index]
    if (!todo) return

    setLists(prev => prev.map(list =>
      list.id === listId
        ? { ...list, todos: list.todos.filter((_, i) => i !== index) }
        : list
    ))
    setCompleted(prev => [...prev, { ...todo, is_completed: true }])
    await supabase.from('todos').update({ is_completed: true }).eq('id', todo.id)
  }

  function findContainer(id) {
    if (id === ROOT_TODO_CONTAINER) return ROOT_TODO_CONTAINER
    if (String(id).startsWith('list-')) return String(id)
    if (todos.some((todo) => todo.id === id)) return ROOT_TODO_CONTAINER
    const listMatch = lists.find((list) => list.todos.some((todo) => todo.id === id))
    return listMatch ? `list-${listMatch.id}` : null
  }

  function getContainerItems(containerId) {
    if (containerId === ROOT_TODO_CONTAINER) return todos
    const listId = String(containerId).replace('list-', '')
    return lists.find((list) => list.id === listId)?.todos || []
  }

  function applyContainerState(nextTodos, nextLists) {
    setTodos(nextTodos)
    setLists(nextLists)
  }

  function setItemsForContainer(containerId, nextItems, currentTodos, currentLists) {
    if (containerId === ROOT_TODO_CONTAINER) {
      return { nextTodos: nextItems, nextLists: currentLists }
    }
    const listId = String(containerId).replace('list-', '')
    return {
      nextTodos: currentTodos,
      nextLists: currentLists.map((list) =>
        list.id === listId ? { ...list, todos: nextItems } : list
      )
    }
  }

  // page_id is included here so Supabase knows which page each todo belongs to
  // when we upsert positions after a drag.
  function persistDragState(currentTodos, currentLists) {
    const allUpdates = [
      ...currentTodos.map((todo, i) => ({
        id: todo.id, user_id: user.id, page_id: pageId, list_id: null,
        text: todo.text, is_completed: todo.is_completed ?? false, position: i
      })),
      ...currentLists.flatMap(list =>
        list.todos.map((todo, i) => ({
          id: todo.id, user_id: user.id, page_id: pageId, list_id: list.id,
          text: todo.text, is_completed: todo.is_completed ?? false, position: i
        }))
      )
    ]
    if (allUpdates.length > 0) {
      supabase.from('todos').upsert(allUpdates)
        .then(({ error }) => { if (error) console.error(error) })
    }
  }

  const handleDragOver = (event) => {
    const { active, over } = event
    if (!over) return
    if (isListSectionId(active.id) || isListSectionId(over.id)) return

    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)

    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    const activeItems = getContainerItems(activeContainer)
    const overItems = getContainerItems(overContainer)
    const activeIndex = activeItems.findIndex((item) => item.id === active.id)
    if (activeIndex < 0) return

    const activeItem = activeItems[activeIndex]
    const overIndex = overItems.findIndex((item) => item.id === over.id)
    const newIndex = overIndex >= 0 ? overIndex : overItems.length

    const nextActiveItems = activeItems.filter((item) => item.id !== active.id)
    const nextOverItems = [
      ...overItems.slice(0, newIndex),
      activeItem,
      ...overItems.slice(newIndex),
    ]

    const firstUpdate = setItemsForContainer(activeContainer, nextActiveItems, todos, lists)
    const secondUpdate = setItemsForContainer(overContainer, nextOverItems, firstUpdate.nextTodos, firstUpdate.nextLists)
    applyContainerState(secondUpdate.nextTodos, secondUpdate.nextLists)
  }

  const handleDragStart = (event) => {
    setActiveDragId(event.active.id)
    setActiveDragType(isListSectionId(event.active.id) ? 'list-section' : 'todo-item')
  }

  const handleDragCancel = () => {
    setActiveDragId(null)
    setActiveDragType(null)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      setActiveDragId(null)
      setActiveDragType(null)
      return
    }

    const activeIsListSection = isListSectionId(active.id)
    const overIsListSection = isListSectionId(over.id)

    if (activeIsListSection && overIsListSection) {
      const activeId = parseListIdFromSectionId(active.id)
      const overId = parseListIdFromSectionId(over.id)

      const oldIndex = lists.findIndex((list) => list.id === activeId)
      const newIndex = lists.findIndex((list) => list.id === overId)

      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        setActiveDragId(null)
        setActiveDragType(null)
        return
      }

      const reorderedLists = arrayMove(lists, oldIndex, newIndex)
      setLists(reorderedLists)
      supabase.from('lists').upsert(
        reorderedLists.map((list, index) => ({
          id: list.id, user_id: user.id, page_id: pageId, title: list.title, position: index
        }))
      ).then(({ error }) => { if (error) console.error(error) })

      setActiveDragId(null)
      setActiveDragType(null)
      return
    }

    if (activeIsListSection || overIsListSection) {
      setActiveDragId(null)
      setActiveDragType(null)
      return
    }

    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)

    if (!activeContainer || !overContainer || activeContainer !== overContainer) {
      persistDragState(todos, lists)
      setActiveDragId(null)
      setActiveDragType(null)
      return
    }

    const containerItems = getContainerItems(activeContainer)
    const oldIndex = containerItems.findIndex((item) => item.id === active.id)
    const newIndex = containerItems.findIndex((item) => item.id === over.id)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      persistDragState(todos, lists)
      setActiveDragId(null)
      setActiveDragType(null)
      return
    }

    const reordered = arrayMove(containerItems, oldIndex, newIndex)
    const updatedState = setItemsForContainer(activeContainer, reordered, todos, lists)
    applyContainerState(updatedState.nextTodos, updatedState.nextLists)
    persistDragState(updatedState.nextTodos, updatedState.nextLists)

    setActiveDragId(null)
    setActiveDragType(null)
  }

  // page_id scopes the new list to this page, same as with todos
  async function handleAddList() {
    const { data, error } = await supabase
      .from('lists')
      .insert({ user_id: user.id, page_id: pageId, title: 'New List', position: lists.length })
      .select()
      .single()

    if (error) { console.error(error); return }

    const newList = { ...data, todos: [] }
    setLists(prev => [...prev, newList])
    setActiveListId(newList.id)
    setPendingRenameListId(newList.id)
  }

  async function handleDeleteList(id) {
    const updatedLists = lists.filter(list => list.id !== id)
    setLists(updatedLists)
    if (activeListId === id) {
      setActiveListId(updatedLists[0]?.id ?? null)
    }
    await supabase.from('lists').delete().eq('id', id)
  }

  async function handleUpdateListTitle(id, newTitle) {
    setLists(prev => prev.map(list =>
      list.id === id ? { ...list, title: newTitle } : list
    ))
    await supabase.from('lists').update({ title: newTitle }).eq('id', id)
  }

  return (
    <div className="page-workspace">
      <TodoInput
        inputRef={todoInputRef}
        todoValue={todoValue}
        setTodoValue={setTodoValue}
        handleAddTodos={handleAddTodos}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={listSectionCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <TodoList
          containerId={ROOT_TODO_CONTAINER}
          activeDragId={activeDragId}
          isInteractionDisabled={activeDragType === 'list-section'}
          handleCompleteTodo={handleCompleteTodo}
          handleEditTodo={handleEditTodo}
          handleDeleteTodo={handleDeleteTodo}
          todos={todos}
        />
        <ListsContainer
          activeDragId={activeDragId}
          activeDragType={activeDragType}
          lists={lists}
          activeListId={activeListId}
          onSelectList={setActiveListId}
          pendingRenameListId={pendingRenameListId}
          onRenamePromptHandled={() => setPendingRenameListId(null)}
          handleAddList={handleAddList}
          handleDeleteList={handleDeleteList}
          handleUpdateListTitle={handleUpdateListTitle}
          handleDeleteListTodo={handleDeleteListTodo}
          handleEditListTodo={handleEditListTodo}
          handleCompleteListTodo={handleCompleteListTodo}
        />
      </DndContext>
    </div>
  )
}

export default Page
