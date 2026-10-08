import React, { useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const TodoCard = ({ id, children, handleDeleteTodo, index, handleEditTodo, handleCompleteTodo, isDragActive = false, isInteractionDisabled = false, justAddedId = null }) => {
    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
    } = useSortable({ id, disabled: isInteractionDisabled })

    const localRef = useRef(null)
    const setRefs = (node) => {
        setNodeRef(node)
        localRef.current = node
    }

    const dragTransform = CSS.Translate.toString(transform)

    const style = {
        transform: isDragActive && dragTransform ? `${dragTransform} scale(1.02)` : dragTransform,
        transition,
        zIndex: isDragActive ? 30 : undefined,
    }

    useEffect(() => {
        if (id === justAddedId) {
            localRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
    }, [id, justAddedId])


  return (
    <li ref={setRefs} style={style} className={`todoItem${isDragActive ? ' isDragging' : ''}`}>
        <i
            className={`fa-solid fa-grip-lines${isDragActive ? ' isDragging' : ''}`}
            {...attributes}
            {...listeners}
            style={{ cursor: isInteractionDisabled ? 'default' : isDragActive ? 'grabbing' : 'grab', touchAction: 'none' }}
        ></i>
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
