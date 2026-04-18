import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as authService from "./auth.service.js";

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body.identifier, req.body.password);
  res.json(result);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refresh(req.body.refreshToken);
  res.json(result);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({ user: req.user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.user!.id);
  res.status(204).send();
});

