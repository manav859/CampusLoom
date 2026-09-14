import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import express, { type Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../src/config/env.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { feesRouter } from "../src/modules/fees/fees.routes.js";
import { reportsRouter } from "../src/modules/reports/reports.routes.js";

/**
 * Teachers never see fees (APP_V2 blueprint §1, plan item 24). This walks
 * every route the fees router declares, so a route added later without a role
 * check fails here. No database is needed: the role check rejects before any
 * handler runs, and the principal's requests stop at body validation.
 */

function token(role: "TEACHER" | "PRINCIPAL") {
  return jwt.sign(
    { schoolId: randomUUID(), role, fullName: `Test ${role}`, phone: "9000000000" },
    env.JWT_ACCESS_SECRET,
    { subject: randomUUID(), expiresIn: "5m" }
  );
}

type RouteLayer = { route?: { path: string; methods: Record<string, boolean> } };

function routesOf(router: Router) {
  return (router.stack as RouteLayer[])
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route!.methods).map((method) => ({
        method: method.toUpperCase(),
        path: layer.route!.path.replace(/:[A-Za-z]+/g, randomUUID())
      }))
    );
}

async function main() {
  const app = express();
  app.use(express.json());
  app.use("/fees", feesRouter);
  app.use("/reports", reportsRouter);
  app.use(errorHandler);

  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (method: string, path: string, bearer?: string, body?: unknown) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {})
      },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {})
    });

  try {
    const teacher = token("TEACHER");
    const feeRoutes = routesOf(feesRouter).map((route) => ({ ...route, path: `/fees${route.path}` }));
    assert.ok(feeRoutes.length >= 20, `expected every fee route, found ${feeRoutes.length}`);

    const routes = [...feeRoutes, { method: "GET", path: "/reports/fees/pending" }];
    for (const route of routes) {
      const response = await call(route.method, route.path, teacher);
      assert.equal(response.status, 403, `teacher ${route.method} ${route.path} should be 403, got ${response.status}`);
    }

    // The same checks are not vacuous: without a token it is 401, and a
    // principal passes the role check and is stopped by validation instead.
    assert.equal((await call("GET", "/fees/dashboard")).status, 401);
    const principalPayment = await call("POST", "/fees/payments", token("PRINCIPAL"), {});
    assert.equal(principalPayment.status, 400, "a principal reaches validation on POST /fees/payments");

    console.log(`fee role access: ${routes.length} routes refuse a teacher`);
  } finally {
    server.close();
  }
}

// The payment rate limiter opens a Redis client when REDIS_URL is set, and its
// reconnect loop would keep the process alive, so exit explicitly.
main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
