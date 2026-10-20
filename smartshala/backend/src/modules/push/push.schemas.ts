import { DevicePlatform } from "@prisma/client";
import { z } from "zod";

// A Firebase Installation ID is a short opaque string — 22 characters today.
// The bounds only keep a malformed body out of the database.
const fid = z.string().min(8).max(512);

export const registerDeviceSchema = z.object({
  fid,
  platform: z.nativeEnum(DevicePlatform)
});

export const unregisterDeviceSchema = z.object({ fid });
