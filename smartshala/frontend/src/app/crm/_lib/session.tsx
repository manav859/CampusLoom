"use client";

import { createContext, useContext } from "react";
import type { CrmUser } from "./types";

export const CrmSessionContext = createContext<CrmUser | null>(null);

/** The signed-in salesperson or admin. Only valid under the CRM layout. */
export function useCrmUser() {
  const user = useContext(CrmSessionContext);
  if (!user) throw new Error("useCrmUser must be used inside the CRM layout");
  return user;
}
