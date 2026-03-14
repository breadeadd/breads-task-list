import { useState, useEffect } from "react"
import { DndContext, closestCenter } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable" 
import TodoInput from "./components/TodoInput"
import TodoList from "./components/TodoList"
import SessionHeader from "./components/SessionHeader" 
import CompletedList from "./components/CompletedList"
import ThemeToggle from "./components/ThemeToggle"
import ListsContainer from "./components/ListsContainer"

const ROOT_TODO_CONTAINER = 'root-todos'

const App = () => {

  //stateful variable [currentVal, updateFunction] = stateCreated
  const [todos, setTodos] = useState([])
  const [todoValue, setTodoValue] = useState('')
  const [completed, setCompleted] = useState([]);
  const [lists, setLists] = useState([])
  const [activeListId, setActiveListId] = useState(null)
  const sessionCount= completed.length;

  //theme save
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem('theme', theme)
    } catch (e) {
      // ignore
    }
  }, [theme])

  function persistTodos(newList) {
    localStorage.setItem('todos', JSON.stringify({ todos: newList }))
  }

  function persistCompleted(newList) {
    localStorage.setItem('completed', JSON.stringify({ completed: newList }))
  }
  
  //Todos
  function handleAddTodos(newTodo) {
    const newTodoItem = {
      id: Date.now(),
      text: newTodo
    }

    const newTodoList = [...todos, newTodoItem]
    persistTodos(newTodoList)
    setTodos(newTodoList)
  }

  function handleDeleteTodo(index) {
    const newTodoList = todos.filter((todo, todoIndex) => {
      return todoIndex !== index
    })
    persistTodos(newTodoList)
    setTodos(newTodoList)
  }

  function handleEditTodo(index) {
    const valueToBeEdited = todos[index]
    setTodoValue(valueToBeEdited.text)
    handleDeleteTodo(index)
  }

  function handleCompleteTodo(index) {
    const todo = todos[index]
    setCompleted((prev) => {
      const updated = [...prev, todo]
      persistCompleted(updated)
      return updated
    })
    handleDeleteTodo(index)
  }

  function handleResetSession() {
    setCompleted([])
    persistCompleted([])
  }

  function handleDeleteListTodo(listId, index) {
    const updatedLists = lists.map((list) =>
      list.id === listId
        ? { ...list, todos: list.todos.filter((_, todoIndex) => todoIndex !== index) }
        : list
    )
    setLists(updatedLists)
    persistLists(updatedLists)
  }

  function handleEditListTodo(listId, index) {
    const listToEdit = lists.find((list) => list.id === listId)
    if (!listToEdit) return

    const valueToBeEdited = listToEdit.todos[index]
    if (!valueToBeEdited) return

    setTodoValue(valueToBeEdited.text)
    handleDeleteListTodo(listId, index)
  }

  function handleCompleteListTodo(listId, index) {
    const listToUpdate = lists.find((list) => list.id === listId)
    if (!listToUpdate) return

    const todo = listToUpdate.todos[index]
    if (!todo) return

    setCompleted((prev) => {
      const updatedCompleted = [...prev, todo]
      persistCompleted(updatedCompleted)
      return updatedCompleted
    })

    handleDeleteListTodo(listId, index)
  }

  function findContainer(id) {
    if (id === ROOT_TODO_CONTAINER) {
      return ROOT_TODO_CONTAINER
    }

    if (String(id).startsWith('list-')) {
      return String(id)
    }

    if (todos.some((todo) => todo.id === id)) {
      return ROOT_TODO_CONTAINER
    }

    const listMatch = lists.find((list) => list.todos.some((todo) => todo.id === id))
    return listMatch ? `list-${listMatch.id}` : null
  }

  function getContainerItems(containerId) {
    if (containerId === ROOT_TODO_CONTAINER) {
      return todos
    }

    const listId = Number(String(containerId).replace('list-', ''))
    return lists.find((list) => list.id === listId)?.todos || []
  }

  function applyContainerState(nextTodos, nextLists) {
    setTodos(nextTodos)
    setLists(nextLists)
    persistTodos(nextTodos)
    persistLists(nextLists)
  }

  function setItemsForContainer(containerId, nextItems, currentTodos, currentLists) {
    if (containerId === ROOT_TODO_CONTAINER) {
      return {
        nextTodos: nextItems,
        nextLists: currentLists
      }
    }

    const listId = Number(String(containerId).replace('list-', ''))
    return {
      nextTodos: currentTodos,
      nextLists: currentLists.map((list) =>
        list.id === listId ? { ...list, todos: nextItems } : list
      )
    }
  }

  const handleDragOver = (event) => {
    const { active, over } = event
    if (!over) return

    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return
    }

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
    const secondUpdate = setItemsForContainer(
      overContainer,
      nextOverItems,
      firstUpdate.nextTodos,
      firstUpdate.nextLists
    )

    applyContainerState(secondUpdate.nextTodos, secondUpdate.nextLists)
  }

  //Handling todo movement
  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)
    if (!activeContainer || !overContainer || activeContainer !== overContainer) return

    const containerItems = getContainerItems(activeContainer)
    const oldIndex = containerItems.findIndex((item) => item.id === active.id)
    const newIndex = containerItems.findIndex((item) => item.id === over.id)
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return

    const reordered = arrayMove(containerItems, oldIndex, newIndex)
    const updatedState = setItemsForContainer(activeContainer, reordered, todos, lists)
    applyContainerState(updatedState.nextTodos, updatedState.nextLists)
  }

  // lists
  function persistLists(newListArray) {
    localStorage.setItem('lists', JSON.stringify({ lists: newListArray }))
  }

  function handleAddList() {
    const newList = {
      id: Date.now(),
      title: 'New List',
      todos: []
    }
    const updatedLists = [...lists, newList]
    setLists(updatedLists)
    setActiveListId(newList.id)
    persistLists(updatedLists)
  }

  function handleDeleteList(id) {
    const updatedLists = lists.filter(list => list.id !== id)
    setLists(updatedLists)
    if (activeListId === id) {
      setActiveListId(updatedLists[0]?.id ?? null)
    }
    persistLists(updatedLists)
  }

  function handleUpdateListTitle(id, newTitle) {
    const updatedLists = lists.map(list => 
      list.id === id ? { ...list, title: newTitle } : list
    )
    setLists(updatedLists)
    persistLists(updatedLists)
  }

  function handleUndoCompleted(index) {
    //get todo object
    const todoToRestore = completed[index]
    //add back to the todo list
    const newTodoList = [...todos, todoToRestore]
    persistTodos(newTodoList)
    setTodos(newTodoList)
    
    //remove from completed list
    const newCompletedList = completed.filter((_, completedIndex) => {
      return completedIndex !== index
    })
    persistCompleted(newCompletedList)
    setCompleted(newCompletedList)
  }

  // Runs when app starts
  useEffect(() => {
    if (!localStorage) {
      return
    }

    const localTodosRaw = localStorage.getItem('todos')
    if (localTodosRaw) {
      const parsed = (JSON.parse(localTodosRaw).todos || []).map((todo, index) => {
        if (typeof todo === 'string') {
          return {
            id: Date.now() + index,
            text: todo
          }
        }

        return todo
      })
      setTodos(parsed)
    }

    const localCompletedRaw = localStorage.getItem('completed')
    if (localCompletedRaw) {
      const parsedCompleted = (JSON.parse(localCompletedRaw).completed || []).map((todo, index) => {
        if (typeof todo === 'string') {
          return {
            id: Date.now() + index,
            text: todo
          }
        }

        return todo
      })
      setCompleted(parsedCompleted)
    }

    // lists
    const localListsRaw = localStorage.getItem('lists')
    if (localListsRaw) {
      const parsedLists = (JSON.parse(localListsRaw).lists || []).map((list) => ({
        ...list,
        todos: Array.isArray(list.todos)
          ? list.todos.map((todo, index) => {
              if (typeof todo === 'string') {
                return {
                  id: Date.now() + index,
                  text: todo
                }
              }

              return todo
            })
          : []
      }))
      setLists(parsedLists)
      setActiveListId(parsedLists[0]?.id ?? null)
    }

  }, [])

  return (
    <div className="App" data-theme={theme}>
      <ThemeToggle theme={theme} setTheme={setTheme} />
      <TodoInput todoValue={todoValue} setTodoValue={setTodoValue} handleAddTodos={handleAddTodos} />
      <DndContext collisionDetection={closestCenter} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <TodoList
          containerId={ROOT_TODO_CONTAINER}
          handleCompleteTodo={handleCompleteTodo}
          handleEditTodo={handleEditTodo}
          handleDeleteTodo={handleDeleteTodo}
          todos={todos}
        />
        <ListsContainer
          lists={lists}
          activeListId={activeListId}
          onSelectList={setActiveListId}
          handleAddList={handleAddList}
          handleDeleteList={handleDeleteList}
          handleUpdateListTitle={handleUpdateListTitle}
          handleDeleteListTodo={handleDeleteListTodo}
          handleEditListTodo={handleEditListTodo}
          handleCompleteListTodo={handleCompleteListTodo}
        />
      </DndContext>
      <SessionHeader count={sessionCount} handleResetSession={handleResetSession}/>
      <CompletedList todos={completed} handleUndoCompleted={handleUndoCompleted}/>
    </div>
  )
}

export default App
