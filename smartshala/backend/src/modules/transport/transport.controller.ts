import type { Request, Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as transportService from "./transport.service.js";

export const overview = asyncHandler(async (req: Request, res: Response) => {
  res.json(await transportService.overview(req.user!));
});

export const report = asyncHandler(async (req: Request, res: Response) => {
  res.json(await transportService.report(req.user!));
});

export const createVehicle = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await transportService.createVehicle(req.user!, req.body));
});

export const updateVehicle = asyncHandler(async (req: Request, res: Response) => {
  res.json(await transportService.updateVehicle(req.user!, req.params.id, req.body));
});

export const deleteVehicle = asyncHandler(async (req: Request, res: Response) => {
  await transportService.deleteVehicle(req.user!, req.params.id);
  res.status(204).end();
});

export const getRoute = asyncHandler(async (req: Request, res: Response) => {
  res.json(await transportService.getRoute(req.user!, req.params.id));
});

export const createRoute = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await transportService.createRoute(req.user!, req.body));
});

export const updateRoute = asyncHandler(async (req: Request, res: Response) => {
  res.json(await transportService.updateRoute(req.user!, req.params.id, req.body));
});

export const deleteRoute = asyncHandler(async (req: Request, res: Response) => {
  await transportService.deleteRoute(req.user!, req.params.id);
  res.status(204).end();
});

export const assignStudents = asyncHandler(async (req: Request, res: Response) => {
  res.json(await transportService.assignStudents(req.user!, req.body));
});

export const unassignStudent = asyncHandler(async (req: Request, res: Response) => {
  await transportService.unassignStudent(req.user!, req.params.studentId);
  res.status(204).end();
});
