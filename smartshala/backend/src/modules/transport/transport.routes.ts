import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./transport.controller.js";
import {
  assignmentSchema,
  idParamsSchema,
  routeSchema,
  studentParamsSchema,
  vehicleSchema
} from "./transport.schemas.js";

export const transportRouter = Router();

transportRouter.use(requireAuth, requireRole([UserRole.PRINCIPAL, UserRole.ADMIN]));

transportRouter.get("/", controller.overview);
transportRouter.get("/report", controller.report);

transportRouter.post("/vehicles", validate({ body: vehicleSchema }), controller.createVehicle);
transportRouter.patch("/vehicles/:id", validate({ params: idParamsSchema, body: vehicleSchema }), controller.updateVehicle);
transportRouter.delete("/vehicles/:id", validate({ params: idParamsSchema }), controller.deleteVehicle);

transportRouter.post("/routes", validate({ body: routeSchema }), controller.createRoute);
transportRouter.get("/routes/:id", validate({ params: idParamsSchema }), controller.getRoute);
transportRouter.patch("/routes/:id", validate({ params: idParamsSchema, body: routeSchema }), controller.updateRoute);
transportRouter.delete("/routes/:id", validate({ params: idParamsSchema }), controller.deleteRoute);

transportRouter.post("/assignments", validate({ body: assignmentSchema }), controller.assignStudents);
transportRouter.delete(
  "/assignments/:studentId",
  validate({ params: studentParamsSchema }),
  controller.unassignStudent
);
