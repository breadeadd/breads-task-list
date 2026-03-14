import React, { useState } from 'react'
import TodoList from './TodoList'

const ListHeader = ({ id, initialTitle, todos = [], isActive, onSelect, onDelete, onUpdate, onDeleteTodo, onEditTodo, onCompleteTodo }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(initialTitle);

    const toggleEdit = () => {
        setIsEditing(!isEditing);
    }

    const handleSave = () => {
        const cleanedTitle = title.trim();
        const nextTitle = cleanedTitle || 'New List';
        setTitle(nextTitle);
        onUpdate(id, nextTitle);
        setIsEditing(false);
    }

  return (
    <div>
      <div className="listHeader">
          {isEditing ? (
              <>
                  <input
                      type = "text"
                      value = {title}
                      autoFocus
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