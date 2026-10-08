"use client";

import { createResourceStore } from "@/lib/resourceStore";
import { superAdminFetch } from "../superAdminFetch";

/** The super admin portal's cache — see createResourceStore for how it behaves. */
export const { fetchResource, prefetch, setResource, invalidate, clearResources, useResource } = createResourceStore(superAdminFetch);
