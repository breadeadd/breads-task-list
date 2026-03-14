import React, { useState } from 'react'

const ListHeader = ({ id, initialTitle, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState("New list");

    const toggleEdit = () => {
        setIsEditing(!isEditing);
    }

  return (
    <div className="listHeader">
        {isEditing ? (
            <>
                <input
                    type = "text"
                    value = {title}
                    autoFocus
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {if (e.key === "Enter") toggleEdit()}}
                />
                <i onClick={toggleEdit} class="fa-regular fa-floppy-disk"></i>
            </>
        ) : (
            <>
                {title}
                <i onClick = {toggleEdit} className="fa-solid fa-pencil"></i>
            </>
        )}
        <i 
            className="fa-regular fa-trash-can" 
            onClick={() => onDelete(id)}></i>

    </div>
  )
}

export default ListHeader