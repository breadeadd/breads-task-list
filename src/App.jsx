import { useState, useEffect } from "react"
import TodoInput from "./components/TodoInput"
import TodoList from "./components/TodoList"
import SessionHeader from "./components/SessionHeader" 
import CompletedList from "./components/CompletedList"
import ThemeToggle from "./components/ThemeToggle"
import ListsContainer from "./components/ListsContainer"

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
  
  function handleAddTodos(newTodo) {
    const newTodoList = [...todos, newTodo]
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
    setTodoValue(valueToBeEdited)
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
      const parsed = JSON.parse(localTodosRaw).todos || []
      setTodos(parsed)
    }

    const localCompletedRaw = localStorage.getItem('completed')
    if (localCompletedRaw) {
      const parsedCompleted = JSON.parse(localCompletedRaw).completed || []
      setCompleted(parsedCompleted)
    }

    // lists
    const localListsRaw = localStorage.getItem('lists')
    if (localListsRaw) {
      const parsedLists = (JSON.parse(localListsRaw).lists || []).map((list) => ({
        ...list,
        todos: Array.isArray(list.todos) ? list.todos : []
      }))
      setLists(parsedLists)
      setActiveListId(parsedLists[0]?.id ?? null)
    }

  }, [])

  return (
    <div className="App" data-theme={theme}>
      <ThemeToggle theme={theme} setTheme={setTheme} />
      <TodoInput todoValue={todoValue} setTodoValue={setTodoValue} handleAddTodos={handleAddTodos} />
      <TodoList handleCompleteTodo={handleCompleteTodo} handleEditTodo={handleEditTodo} handleDeleteTodo={handleDeleteTodo} todos={todos} />
      <ListsContainer
        lists={lists}
        activeListId={activeListId}
        onSelectList={setActiveListId}
        handleAddList={handleAddList}
        handleDeleteList={handleDeleteList}
        handleUpdateListTitle={handleUpdateListTitle}
      />
      <SessionHeader count={sessionCount} handleResetSession={handleResetSession}/>
      <CompletedList todos={completed} handleUndoCompleted={handleUndoCompleted}/>
    </div>
  )
}

export default App
