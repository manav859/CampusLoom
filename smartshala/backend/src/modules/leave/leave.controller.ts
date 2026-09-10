import type { Request, Response } from "express";
import { join } from "node:path";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as leaveService from "./leave.service.js";

export const applyForLeave = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await leaveService.applyForLeave(req.user!, req.body, req.file));
});

export const listMyLeave = asyncHandler(async (req: Request, res: Response) => {
  res.json(await leaveService.listMyLeave(req.user!, req.query as never));
});

export const listSchoolLeave = asyncHandler(async (req: Request, res: Response) => {
  res.json(await leaveService.listSchoolLeave(req.user!, req.query as never));
});

export const decideLeave = asyncHandler(async (req: Request, res: Response) => {
  res.json(await leaveService.decideLeave(req.user!, req.params.id, req.body));
});

export const cancelLeave = asyncHandler(async (req: Request, res: Response) => {
  res.json(await leaveService.cancelLeave(req.user!, req.params.id));
});

export const downloadAttachment = asyncHandler(async (req: Request, res: Response) => {
  const { downloadUrl, fileName } = await leaveService.downloadAttachment(req.user!, req.params.id);

  // Same split as student documents: S3 hands back a presigned URL for the
  // client to open, the local dev fallback streams the file itself.
  if (downloadUrl.startsWith("http")) {
    res.json({ downloadUrl, fileName });
    return;
  }

  const localPath = join(process.cwd(), "uploads", ...downloadUrl.split("/"));
  await new Promise<void>((resolve, reject) => {
    res.download(localPath, fileName, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});
