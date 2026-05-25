# 📝 Bread's Task List

Most productivity tools fall into two traps: 
They are either too shallow to keep you organized or so complex that they become a chore to maintain. **Bread's Task List** is a "digital sticky-note" ecosystem built to bridge the gap between simple lists and rigid project managers. It is specifically designed for users (like busy university students) who need to categorize tasks into sprints and track momentum without the friction of complex scheduling.

## ⭐ Why Bread?

I built Bread because I noticed a missing element in traditional todo apps: **Contextual Focus.** Seeing a single, massive "Wall of Tasks" is paralyzing. Bread solves this by focusing on:

* **Accomplishment-Based Sprints:** Most lists are infinite loops. Bread's **Session Tracker** captures your momentum in real-time. Whether it's a single study block or your whole day, you see exactly what you've achieved *right now*, turning progress into immediate positive reinforcement.
  
* **Contextual Organization:** Stop getting overwhelmed by your grocery list while you're trying to study. **Custom Sectioning** allows you to compartmentalize different areas of your life (Uni, Work, Packing Lists) into distinct headers, keeping your workspace clean and your mind focused on one goal at a time.

* **Multiple Workspaces:** Need a completely separate space for a new project or life area? **Pages** let you create up to 8 independent workspaces, each with their own inbox and custom sections. Switch between them instantly with the tab bar — no cross-contamination, no clutter.

* **Instant, Frictionless Entry:** Bread is designed for "Brain Dumps." There are no mandatory deadlines or priority dropdowns - just a clean interface to get thoughts out of your head and into a list in under two seconds.
  
* **Persistent Memory:** Built for the long haul. Your tasks, custom sections, and pages are stored in a real cloud database — so your workflow is waiting for you on any device, any browser, any time.

## 🚀 Key Features & UX Philosophy

* **Cognitive Load Reduction:** By categorizing tasks into headers and separating contexts into pages, users can focus on one thing at a time while hiding the distraction of everything else. This "Sticky Note" approach ensures you only see what is relevant to your current mission.
  
* **Gamified Productivity:** Unlike lists that reset daily, the Session Tracker is designed for the "immediate timeframe." It captures the momentum of a single session, providing a psychological "win" that motivates the next hour of work.
  
* **Intuitive Visual Language:** Featuring a simple, accessible color palette, custom FontAwesome iconography, and a built-in **Theme Switcher** (Dark/Light mode) to ensure the app feels comfortable in any environment - from a bright library to a late-night study session.

## 💻 Technical Deep Dive

* **Multi-Page Architecture:** Pages are independent workspaces managed in `App.jsx` and rendered as a tab bar of `PageTab` components. Switching pages destroys and recreates the `Page` component via React's `key` prop, guaranteeing a clean state reset and a fresh Supabase data fetch for every page switch.

* **Complex Nested State:** Managed a two-layer state architecture — `App.jsx` owns auth, pages, and the session-wide completed list, while `Page.jsx` owns all todo and list state scoped to the active page. Custom handlers perform immutable updates even three levels deep, ensuring React re-renders efficiently.
  
* **Advanced DND Logic:** Beyond basic dragging, I utilized `@dnd-kit/core` to implement **Cross-Container Transfer**. This allows tasks to move fluidly between the global "Inbox" and specific "List Sections" by calculating real-time collision detections. A custom collision strategy also allows entire list sections to be reordered independently of the todo drag system.

* **Supabase Backend:** The app uses Supabase for auth, a cloud Postgres database, and Row Level Security. Every write is an optimistic update — state changes immediately while the Supabase call runs in the background. Drag-and-drop reordering uses batch `upsert` to persist position changes for all affected items in a single request.

* **User Accounts:** Sign up, sign in, and sign out with email and password. Row Level Security policies on every table ensure users can only ever read or write their own data. First-time users who had data in `localStorage` from the old version have it migrated to Supabase automatically on first login.

## ‼️ Deployment

[Try it out here!](https://breadeaddtasklist.netlify.app/)
