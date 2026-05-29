import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { rateLimit } from "../../lib/rateLimit.js";
import type { Request } from "express";
import * as controller from "./auth.controller.js";
import { forgotPasswordSchema, loginSchema, refreshSchema, registerSchema } from "./auth.schemas.js";

export const authRouter = Router();

// Key by IP + identifier to prevent both spraying and targeted lockout bypass
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 min
  max: 10,
  keyPrefix: "auth:login",
  keyFn: (req: Request) => {
    const ip = (req.ip ?? "unknown").replace(/^::ffff:/, "");
    const id = String(req.body?.identifier ?? "").toLowerCase().slice(0, 64);
    return `${ip}:${id}`;
  },
  message: "Too many login attempts. Please wait 15 minutes before trying again.",
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 5,
  keyPrefix: "auth:forgot",
  message: "Too many reset requests. Please wait 1 hour.",
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "auth:register",
});

const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  keyPrefix: "auth:refresh",
});

authRouter.post("/register",
  registerLimiter,
  validate({ body: registerSchema }),
  controller.register
);

authRouter.post("/login",
  loginLimiter,
  validate({ body: loginSchema }),
  controller.login
);

authRouter.post("/forgot-password",
  forgotLimiter,
  validate({ body: forgotPasswordSchema }),
  controller.forgotPassword
);

authRouter.post("/refresh",
  refreshLimiter,
  validate({ body: refreshSchema }),
  controller.refresh
);
authRouter.get("/me", requireAuth, controller.me);
authRouter.post("/logout", requireAuth, controller.logout);
