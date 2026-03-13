import React from "react"
import "./ThemeToggle.css"

const ThemeToggle = ({ theme, setTheme }) => {
    const isChecked = theme === 'dark'
    const handleChange = () => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
    }

    return (
        <div className="toggle-container">
            <p>Bread's Task List</p>
            <input
                type="checkbox"
                id="check"
                className="toggle"
                onChange={handleChange}
                checked={isChecked}
            />
            <label htmlFor="check"> theme </label>
        </div>
    )
}

export default ThemeToggle