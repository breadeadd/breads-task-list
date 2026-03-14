import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const TodoCard = ({ id, children, handleDeleteTodo, index, handleEditTodo, handleCompleteTodo }) => {
    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
    } = useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }


  return (
    <li ref={setNodeRef} style={style} className='todoItem'>
        <i className="fa-solid fa-grip-lines" {...attributes} {...listeners}></i>
        {children}
        <div className="actionsContainer">
            {/* Delete Button */}
            <button onClick={() => {
                handleDeleteTodo(index)
            }}>
                <i className="fa-regular fa-trash-can"></i>
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
                <i className="fa-solid fa-check"></i>
            </button>
        </div>            
    </li>
  )
}

export default TodoCard
