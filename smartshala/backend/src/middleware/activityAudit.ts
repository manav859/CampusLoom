import type { NextFunction, Request, Response } from "express";
import { recordAuditLog } from "../core/auditLog.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE_KEYS = new Set([
  "authorization",
  "accessToken",
  "refreshToken",
  "password",
  "passwordHash",
  "token",
  "oldPassword",
  "newPassword",
  "confirmPassword"
]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key) ? "[REDACTED]" : sanitize(item)
    ])
  );
}

function entityFromPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  const apiIndex = parts.findIndex((part) => part === "api" || part === "v1");
  const afterApi = apiIndex >= 0 ? parts.slice(apiIndex + 1) : parts;
  if (afterApi[0] === "v1") afterApi.shift();
  return (afterApi[0] ?? "platform").replace(/-/g, "_").toUpperCase();
}

function findUuid(value: unknown): string | null {
  if (typeof value === "string" && UUID_RE.test(value)) return value;
  if (!value || typeof value !== "object") return null;

  for (const item of Object.values(value as Record<string, unknown>)) {
    const found = findUuid(item);
    if (found) return found;
  }
  return null;
}

function actionFor(method: string) {
  if (method === "POST") return "CREATE_OR_RUN";
  if (method === "PUT") return "REPLACE";
  if (method === "PATCH") return "UPDATE";
  if (method === "DELETE") return "DELETE";
  return method;
}

function isNotificationSendAudit(path: string) {
  return /\/api(?:\/v1)?\/wa\/(send|bulk)(?:\?|$|\/)/.test(path)
    || /\/api(?:\/v1)?\/wa\/logs\/[0-9a-f-]+\/retry(?:\?|$|\/)/i.test(path)
    || (path.includes("/communication/messages") && /\/api(?:\/v1)?\/communication\/messages(?:\?|$|\/)/.test(path));
}

export function auditMutatingRequest(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();

  res.on("finish", () => {
    if (!MUTATING_METHODS.has(req.method)) return;
    if (!req.user) return;
    if (res.statusCode >= 400) return;
    if (req.originalUrl.includes("/activity-logs")) return;
    if (req.originalUrl.includes("/auth/logout")) return;
    // Chatbot logs one consolidated entry per conversation itself (see
    // chatbot.controller), so skip the generic per-request logging here.
    if (/\/api(?:\/v1)?\/chatbot(?:\/|$)/.test(req.originalUrl)) return;
    if (/\/api(?:\/v1)?\/students(?:\/|$)/.test(req.originalUrl)) return;
    if (/\/api(?:\/v1)?\/attendance\/mark(?:\/|$|\?)/.test(req.originalUrl)) return;
    if (/\/api(?:\/v1)?\/fees\/(payment|payments|adjustments|fee-adjustments)(?:\/|$)/.test(req.originalUrl)) return;
    if (/\/api(?:\/v1)?\/settings\/school-profile(?:\/|$|\?)/.test(req.originalUrl)) return;
    if (isNotificationSendAudit(req.originalUrl)) return;

    const entityType = entityFromPath(req.originalUrl);
    const entityId = findUuid(req.params) ?? findUuid(req.body) ?? req.user.id ?? req.user.schoolId;

    void recordAuditLog({
      action: actionFor(req.method),
      actorId: req.user.id,
      entityId,
      entityType,
      schoolId: req.user.schoolId,
      summary: `${req.user.fullName} ${req.method} ${req.originalUrl}`,
      after: {
        body: sanitize(req.body),
        durationMs: Date.now() - startedAt,
        method: req.method,
        params: sanitize(req.params),
        path: req.originalUrl,
        query: sanitize(req.query),
        statusCode: res.statusCode
      }
    }).catch(() => undefined);
  });

  next();
}
