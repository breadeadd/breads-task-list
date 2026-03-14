import React from 'react'
import ListHeader from './ListHeader'

const ListsContainer = ({
  lists,
  activeListId,
  onSelectList,
  handleAddList,
  handleDeleteList,
  handleUpdateListTitle
}) => {

  return (
    <div className = "listContainer">
        <div style={{ marginLeft: 'auto' }}>
          <i onClick={handleAddList} className="fa-solid fa-plus"></i>
        </div>
        {lists.map((list) => (
          <ListHeader 
          key={list.id} 
          id = {list.id}
          initialTitle={list.title} 
          todos={list.todos}
          isActive={activeListId === list.id}
          onSelect={onSelectList}
          onDelete = {handleDeleteList}
          onUpdate = {handleUpdateListTitle}
          />
        ))}
    </div>
  )
}

export default ListsContainer