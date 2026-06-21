// React Context + provider over the pure store (store.ts). Screens consume the
// state via useAppState() and dispatch actions via useAppDispatch().

import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from 'react';
import {
  appReducer,
  createInitialState,
  type AppAction,
  type AppState,
  type InitInputs,
} from './store';

const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null);

export function AppProvider({ init, children }: { init: InitInputs; children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, init, createInitialState);
  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>{children}</AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (ctx === null) throw new Error('useAppState must be used within an AppProvider');
  return ctx;
}

export function useAppDispatch(): Dispatch<AppAction> {
  const ctx = useContext(AppDispatchContext);
  if (ctx === null) throw new Error('useAppDispatch must be used within an AppProvider');
  return ctx;
}
