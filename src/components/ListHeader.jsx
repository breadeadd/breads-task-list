import React, { useEffect, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TodoList from './TodoList'

const ListHeader = ({ id, activeDragId, activeDragType, justAddedId, initialTitle, todos = [], shouldAutoEdit, onAutoEditHandled, onDelete, onUpdate, onDeleteTodo, onEditTodo, onCompleteTodo }) => {
    const sortableId = `list-section-${id}`
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(initialTitle);
    const {
        setNodeRef,
        setActivatorNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        } = useSortable({
        id: sortableId,
        data: { type: 'list-section', listId: id },
    })
    
    
    const dragTransform = CSS.Translate.toString(transform)
    const isDragActive = activeDragId === sortableId

    const style = {
        transform: isDragActive && dragTransform ? `${dragTransform} scale(1.01)` : dragTransform,
        transition,
        zIndex: isDragActive ? 20 : undefined,
    }


    useEffect(() => {
        if (!shouldAutoEdit) return

        const animationFrameId = requestAnimationFrame(() => {
            setIsEditing(true)
        })
        onAutoEditHandled?.()

        return () => cancelAnimationFrame(animationFrameId)
    }, [shouldAutoEdit, onAutoEditHandled])

    const handleSave = () => {
        const cleanedTitle = title.trim();
        const nextTitle = cleanedTitle || 'New List';
        setTitle(nextTitle);
        onUpdate(id, nextTitle);
        setIsEditing(false);
    }

  return (
        <div ref={setNodeRef} style={style} className = {`list${isDragActive ? ' isDragging' : ''}`}>
      <div className="listHeader">
        <i 
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
                style={{ cursor: isDragActive ? 'grabbing' : 'grab', touchAction: 'none' }}
        className="fa-solid fa-grip-vertical" />
        
          {isEditing ? (
              <>
                  <input
                      type = "text"
                      value = {title}
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setTitle(e.target.value)}
                      onKeyDown={(e) => {if (e.key === "Enter") handleSave()}}
                  />
                  <i onClick={handleSave} className="fa-regular fa-floppy-disk"></i>
              </>
          ) : (
              <>
                  {title}
                  <i onClick={() => setIsEditing(true)} className="fa-solid fa-pencil"></i>
              </>
          )}
          <i 
              className="fa-regular fa-trash-can" 
              onClick={() => onDelete(id)}></i>
      </div>

            <TodoList
                containerId={`list-${id}`}
                activeDragId={activeDragId}
                justAddedId={justAddedId}
                isInteractionDisabled={activeDragType === 'list-section'}
                className="listDropzone"
                emptyMessage="Drop tasks here"
                todos={todos}
                handleDeleteTodo={(index) => onDeleteTodo(id, index)}
                handleEditTodo={(index) => onEditTodo(id, index)}
                handleCompleteTodo={(index) => onCompleteTodo(id, index)}
            />

    </div>
  )
}

export default ListHeader