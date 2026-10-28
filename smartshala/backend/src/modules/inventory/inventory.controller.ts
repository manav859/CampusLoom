import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as inventoryService from "./inventory.service.js";

export const overview = asyncHandler(async (req: Request, res: Response) => {
  res.json(await inventoryService.overview(req.user!));
});

export const report = asyncHandler(async (req: Request, res: Response) => {
  res.json(await inventoryService.report(req.user!, req.query as never));
});

// --- categories ---

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  res.json(await inventoryService.listCategories(req.user!));
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await inventoryService.createCategory(req.user!, req.body));
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  res.json(await inventoryService.updateCategory(req.user!, req.params.id, req.body));
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await inventoryService.deleteCategory(req.user!, req.params.id);
  res.status(204).end();
});

// --- vendors ---

export const listVendors = asyncHandler(async (req: Request, res: Response) => {
  res.json(await inventoryService.listVendors(req.user!));
});

export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await inventoryService.createVendor(req.user!, req.body));
});

export const updateVendor = asyncHandler(async (req: Request, res: Response) => {
  res.json(await inventoryService.updateVendor(req.user!, req.params.id, req.body));
});

export const deleteVendor = asyncHandler(async (req: Request, res: Response) => {
  await inventoryService.deleteVendor(req.user!, req.params.id);
  res.status(204).end();
});

// --- items ---

export const listItems = asyncHandler(async (req: Request, res: Response) => {
  res.json(await inventoryService.listItems(req.user!, req.query as never));
});

export const getItem = asyncHandler(async (req: Request, res: Response) => {
  res.json(await inventoryService.getItem(req.user!, req.params.id));
});

export const createItem = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await inventoryService.createItem(req.user!, req.body));
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  res.json(await inventoryService.updateItem(req.user!, req.params.id, req.body));
});

export const deleteItem = asyncHandler(async (req: Request, res: Response) => {
  await inventoryService.deleteItem(req.user!, req.params.id);
  res.status(204).end();
});

// --- transactions ---

export const recordTransaction = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await inventoryService.recordTransaction(req.user!, req.params.id, req.body));
});

export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  res.json(await inventoryService.listTransactions(req.user!, req.query as never));
});
