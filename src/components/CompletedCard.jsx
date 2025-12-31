import React, { memo } from 'react'

export default function CompletedCard(props) {
const { children, index, handleUndoCompleted } = props
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

