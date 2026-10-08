"use client";

import { createResourceStore } from "@/lib/resourceStore";
import { crmFetch } from "../crmFetch";

/** The CRM's cache — see createResourceStore for how it behaves. */
export const { prefetch, setResource, invalidate, clearResources, useResource } = createResourceStore(crmFetch);
