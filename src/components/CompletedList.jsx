import React, { memo } from 'react'
import CompletedCard from './CompletedCard'

export default function CompletedList(props) {
    const { todos, handleUndoCompleted } = props
    return (
        <ul className="main">
            {todos.map((completed, index) => {
                    return(
                    <CompletedCard key={index} index={index} handleUndoCompleted={handleUndoCompleted}>
                        <p>{completed}</p>
                    </CompletedCard>
                )
            })}
        </ul>
    )
}
