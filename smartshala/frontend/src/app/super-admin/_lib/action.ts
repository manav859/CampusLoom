"use client";

import { useCallback, useState } from "react";
import { errorMessage } from "./format";
import { useNotify } from "./notify";

/**
 * Runs a mutation and reports it. Only the button that started the work shows
 * a spinner — the rest of the screen stays usable — and the outcome goes to the
 * shared notifications instead of a banner every page has to render.
 */
export function useAction() {
  const notify = useNotify();
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  const run = useCallback(
    async <T>(key: string, work: () => Promise<T>, success?: string | ((result: T) => string)): Promise<T | undefined> => {
      setPending((current) => new Set(current).add(key));
      try {
        const result = await work();
        if (success) notify.success(typeof success === "function" ? success(result) : success);
        return result;
      } catch (error) {
        notify.error(errorMessage(error));
        return undefined;
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [notify]
  );

  const isPending = useCallback((key: string) => pending.has(key), [pending]);

  return { run, isPending };
}
