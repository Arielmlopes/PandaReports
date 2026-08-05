import { createContext, useContext, useReducer, useCallback } from 'react'

const AppContext = createContext(null)

const initialState = {
  clients: [],
  collaborators: [],
  notifications: [],
  toast: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CLIENTS': return { ...state, clients: action.payload }
    case 'ADD_CLIENT': return { ...state, clients: [...state.clients, action.payload] }
    case 'UPDATE_CLIENT': return { ...state, clients: state.clients.map(c => c.id === action.payload.id ? action.payload : c) }
    case 'DELETE_CLIENT': return { ...state, clients: state.clients.filter(c => c.id !== action.payload) }
    case 'SET_COLLABORATORS': return { ...state, collaborators: action.payload }
    case 'ADD_COLLABORATOR': return { ...state, collaborators: [...state.collaborators, action.payload] }
    case 'DELETE_COLLABORATOR': return { ...state, collaborators: state.collaborators.filter(c => c.id !== action.payload) }
    case 'SET_NOTIFICATIONS': return { ...state, notifications: action.payload }
    case 'ADD_NOTIFICATION': return { ...state, notifications: [action.payload, ...state.notifications] }
    case 'MARK_NOTIF_READ': return { ...state, notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n) }
    case 'MARK_ALL_READ': return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) }
    case 'SHOW_TOAST': return { ...state, toast: action.payload }
    case 'HIDE_TOAST': return { ...state, toast: null }
    default: return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const showToast = useCallback((message, type = 'success') => {
    dispatch({ type: 'SHOW_TOAST', payload: { message, type, id: Date.now() } })
    setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 3500)
  }, [])

  return (
    <AppContext.Provider value={{ ...state, dispatch, showToast }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
