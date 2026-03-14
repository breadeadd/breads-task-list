import React, { useState } from 'react'
import ListHeader from './ListHeader'
import TodoCard from './TodoCard'

const ListsContainer = () => {
  const [lists, setLists] = useState([
    {id: 1, title: "New list"}
  ])

  //Adding new item
  const addList = () => {
    const newList = {
      id: Date.now(),
      title: "New List"
    };
    setLists([...lists, newList]);
  };

  //Deleting a List
  const deleteList = (idToDelete) => {
    const updatedLists = lists.filter(list => list.id !== idToDelete);
    setLists(updatedLists);
  }

  return (
    <div className = "listContainer">
        <div style={{ marginLeft: 'auto' }}>
          <i onClick={addList} class="fa-solid fa-plus"></i>
        </div>
        {lists.map((list) => (
          <ListHeader 
          key={list.id} 
          id = {list.id} //Pass the ID to child
          initialTitle={list.title} 
          onDelete = {deleteList} //Pass the function
          />
        ))}
    </div>
  )
}

export default ListsContainer