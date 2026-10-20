import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./push.controller.js";
import { registerDeviceSchema, unregisterDeviceSchema } from "./push.schemas.js";

/**
 * Where the two apps hand in their Firebase Installation ID. Open to every
 * signed-in role: what a user is allowed to be told is decided when a
 * notification is sent, not by who may own a device.
 */
export const pushRouter = Router();

pushRouter.use(requireAuth);
pushRouter.post("/devices", validate({ body: registerDeviceSchema }), controller.registerDevice);
// A DELETE with a body rather than a path segment: a FID identifies a device
// and does not belong in a URL, where it would land in access logs.
pushRouter.delete("/devices", validate({ body: unregisterDeviceSchema }), controller.unregisterDevice);
