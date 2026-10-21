import { createContext } from 'react';

// Closes the ⋮ menu of a header (HeaderActions) its buttons are in: they show their label there,
// and close the menu when pressed. Undefined outside a menu.
export const MenuContext = createContext<(() => void) | undefined>(undefined);
