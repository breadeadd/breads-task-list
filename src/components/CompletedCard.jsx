import React from 'react'

const CompletedCard = ({ children, index, handleUndoCompleted }) => {
  return (
    <li className="completedItem">
      {children}
      <button onClick={() =>{
        handleUndoCompleted(index)
      }}>
        <i class="fa-solid fa-reply"></i>
      </button>
    </li>
  )
}

export default CompletedCard

