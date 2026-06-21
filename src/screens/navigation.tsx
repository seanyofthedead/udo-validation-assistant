// In-app navigation — a tiny state-based router (no router dependency; SPEC §2
// keeps the stack minimal). Tracks the current screen and the currently selected
// UDO so the Inventory/Queue can deep-link into the Detail and Review screens.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ScreenId } from './registry';

interface Navigation {
  screen: ScreenId;
  selectedUdoId: string | null;
  /** Go to a screen, optionally selecting a UDO. */
  navigate: (screen: ScreenId, udoId?: string) => void;
  /** Select a UDO and jump to its Detail screen. */
  inspect: (udoId: string) => void;
}

const NavContext = createContext<Navigation | null>(null);

export function NavProvider({
  initialScreen = 'dashboard',
  children,
}: {
  initialScreen?: ScreenId;
  children: ReactNode;
}) {
  const [screen, setScreen] = useState<ScreenId>(initialScreen);
  const [selectedUdoId, setSelectedUdoId] = useState<string | null>(null);

  const value = useMemo<Navigation>(
    () => ({
      screen,
      selectedUdoId,
      navigate: (next, udoId) => {
        setScreen(next);
        if (udoId !== undefined) setSelectedUdoId(udoId);
      },
      inspect: (udoId) => {
        setSelectedUdoId(udoId);
        setScreen('detail');
      },
    }),
    [screen, selectedUdoId],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNavigation(): Navigation {
  const ctx = useContext(NavContext);
  if (ctx === null) throw new Error('useNavigation must be used within a NavProvider');
  return ctx;
}
