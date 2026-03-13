import React from 'react'

const TodoCard = ({ children, handleDeleteTodo, index, handleEditTodo, handleCompleteTodo }) => {
  return (
    <li className='todoItem'>
        {children}
        <div className="actionsContainer">
            {/* Delete Button */}
            <button onClick={() => {
                handleDeleteTodo(index)
            }}>
                <i class="fa-regular fa-trash-can"></i>
            </button>

            {/* Edit Button */}
            <button onClick={() => {
                handleEditTodo(index)
            }}>
                <i className="fa-regular fa-pen-to-square"></i>
            </button>

            {/* Completed Button */}
            <button onClick={() => {
                handleCompleteTodo(index)
            }}>
                <i class="fa-solid fa-check"></i>
            </button>
        </div>            
    </li>
  )
}

export default TodoCard
