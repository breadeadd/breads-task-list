import React from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import ListHeader from './ListHeader'

const ListsContainer = ({
  lists,
  activeDragId,
  activeDragType,
  justAddedId,
  activeListId,
  onSelectList,
  pendingRenameListId,
  onRenamePromptHandled,
  handleAddList,
  handleDeleteList,
  handleUpdateListTitle,
  handleDeleteListTodo,
  handleEditListTodo,
  handleCompleteListTodo
}) => {

  return (
    <div className = "listContainer">
        <div style={{ marginLeft: 'auto' }}>
          Create Lists <i onClick={handleAddList} className="fa-solid fa-plus"></i>
        </div>

        <SortableContext
          items={lists.map((list) => `list-section-${list.id}`)}
          strategy={verticalListSortingStrategy}
        >
          
        {lists.map((list) => (
          <ListHeader 
          key={list.id} 
          id = {list.id}
          activeDragId={activeDragId}
          activeDragType={activeDragType}
          justAddedId={justAddedId}
          initialTitle={list.title}
          todos={list.todos}
          isActive={activeListId === list.id}
          onSelect={onSelectList}
          shouldAutoEdit={pendingRenameListId === list.id}
          onAutoEditHandled={onRenamePromptHandled}
          onDelete = {handleDeleteList}
          onUpdate = {handleUpdateListTitle}
          onDeleteTodo={handleDeleteListTodo}
          onEditTodo={handleEditListTodo}
          onCompleteTodo={handleCompleteListTodo}
          />
        ))}
        </SortableContext>
    </div>
  )
}

export default ListsContainer