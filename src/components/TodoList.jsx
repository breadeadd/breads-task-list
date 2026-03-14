import React from 'react'
import TodoCard from './TodoCard'

const TodoList = (props) => {
    const { todos } = props

  return (
    <ul className="main">
        {todos.map((todo, todoIndex) => {
            return(
                <TodoCard 
                    {...props}
                    key={todo.id}
                    id={todo.id}
                    index={todoIndex}
                >
                    <p>{todo.text}</p>
                </TodoCard>
            )
        })}
    </ul>
  )
}

export default TodoList
