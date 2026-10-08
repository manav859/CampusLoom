import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import { clearRefreshCookie, getRefreshToken, setRefreshCookie } from "../../lib/refreshCookie.js";
import * as authService from "./auth.service.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
});

const isMobile = (req: Request) => String(req.headers["x-client-type"] ?? "").toLowerCase() === "mobile";

export const login = asyncHandler(async (req: Request, res: Response) => {
  const isMobileClient = isMobile(req);
  const result = await authService.login(req.body.identifier, req.body.password, req.ip ?? "unknown", isMobileClient);

  // Refresh token goes into an httpOnly cookie; only the access token is returned in the body.
  setRefreshCookie(res, result.refreshToken, authService.sessionLengthMs(isMobileClient));

  // Native mobile clients cannot read that cookie, so they also get the refresh
  // token in the body and keep it in the device's secure storage.

  res.json({
    accessToken: result.accessToken,
    user: result.user,
    ...(isMobileClient ? { refreshToken: result.refreshToken } : {})
  });
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

  // A renewed session comes back with a new refresh token: the cookie is
  // replaced, and the apps also get it in the body for secure storage.
  const mobile = isMobile(req);
  const result = await authService.refresh(refreshToken, mobile);
  if (result.refreshToken) setRefreshCookie(res, result.refreshToken, authService.sessionLengthMs(mobile));
  res.json({ accessToken: result.accessToken, ...(mobile && result.refreshToken ? { refreshToken: result.refreshToken } : {}) });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.id);
  res.json({ user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.user!.id, req.user!.schoolId ?? null, req.ip ?? "unknown", getRefreshToken(req));
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
