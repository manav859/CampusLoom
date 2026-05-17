import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";

export const apiHealthHandler: RequestHandler = (_req, res) => {
  res.json({ status: "ok", service: "smartshala-api", version: "1.0.0" });
};

export const dbHealthHandler: RequestHandler = async (_req, res) => {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      database: "connected",
      timestamp
    });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";

    res.status(503).json({
      status: "error",
      database: "unavailable",
      error: errorName,
      timestamp
    });
  }
};
