import React from 'react'
import CompletedCard from './CompletedCard'

const CompletedList = ({ todos, handleUndoCompleted }) => {
    return (
        <ul className="main">
            {todos.map((completed, index) => {
                    return(
                    <CompletedCard key={index} index={index} handleUndoCompleted={handleUndoCompleted}>
                        <p>{completed.text}</p>
                    </CompletedCard>
                )
            })}
        </ul>
    )
}

export default CompletedList
