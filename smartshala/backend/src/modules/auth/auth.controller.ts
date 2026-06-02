import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import { clearRefreshCookie, getRefreshToken, setRefreshCookie } from "../../lib/refreshCookie.js";
import * as authService from "./auth.service.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body.identifier, req.body.password, req.ip ?? "unknown");

  // Refresh token goes into an httpOnly cookie; only the access token is returned in the body.
  setRefreshCookie(res, result.refreshToken);
  res.json({ accessToken: result.accessToken, user: result.user });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.forgotPassword(req.body.identifier);
  res.status(202).json(result);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = getRefreshToken(req);
  if (!refreshToken) {
    return res.status(401).json({
      error: { code: "MISSING_REFRESH_TOKEN", message: "No refresh token provided" }
    });
  }

  // authService.refresh does not rotate the refresh token, so the existing cookie stays in place.
  const result = await authService.refresh(refreshToken);
  res.json({ accessToken: result.accessToken });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.id);
  res.json({ user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.user!.id, req.user!.schoolId ?? null, req.ip ?? "unknown");
  clearRefreshCookie(res);
  res.status(204).send();
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.updateProfile(req.user!.id, req.body);
  res.json(result);
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  res.status(200).json({ success: true, message: "Password updated successfully" });
});
