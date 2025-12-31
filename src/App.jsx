import { useState, useEffect } from "react"
import TodoInput from "./components/TodoInput"
import TodoList from "./components/TodoList"
import SessionHeader from "./components/SessionHeader" 
import CompletedList from "./components/CompletedList"

function App() {

  //stateful variable [currentVal, updateFunction] = stateCreated
  const [todos, setTodos] = useState([])
  const [todoValue, setTodoValue] = useState('')
  const [completed, setCompleted] = useState([]);
  const sessionCount= completed.length;

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

  }, [])

  return (
    <>
      <TodoInput todoValue={todoValue} setTodoValue={setTodoValue} handleAddTodos={handleAddTodos} />
      <TodoList handleCompleteTodo={handleCompleteTodo} handleEditTodo={handleEditTodo} handleDeleteTodo={handleDeleteTodo} todos={todos} />
      <SessionHeader count={sessionCount} handleResetSession={handleResetSession}/>
      <CompletedList todos={completed} handleUndoCompleted={handleUndoCompleted}/>
    </>
  )
}

export default App
