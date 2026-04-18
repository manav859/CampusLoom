import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./auth.controller.js";
import { loginSchema, refreshSchema } from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post("/login", validate({ body: loginSchema }), controller.login);
authRouter.post("/refresh", validate({ body: refreshSchema }), controller.refresh);
authRouter.get("/me", requireAuth, controller.me);
authRouter.post("/logout", requireAuth, controller.logout);

