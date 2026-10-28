import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./inventory.controller.js";
import {
  categorySchema,
  idParamsSchema,
  itemSchema,
  itemsQuerySchema,
  reportQuerySchema,
  transactionSchema,
  transactionsQuerySchema,
  vendorSchema
} from "./inventory.schemas.js";

export const inventoryRouter = Router();

// Inventory is managed by the Principal and the Accountant only.
inventoryRouter.use(requireAuth, requireRole([UserRole.PRINCIPAL, UserRole.ACCOUNTANT]));

inventoryRouter.get("/", controller.overview);
inventoryRouter.get("/report", validate({ query: reportQuerySchema }), controller.report);

inventoryRouter.get("/categories", controller.listCategories);
inventoryRouter.post("/categories", validate({ body: categorySchema }), controller.createCategory);
inventoryRouter.patch("/categories/:id", validate({ params: idParamsSchema, body: categorySchema }), controller.updateCategory);
inventoryRouter.delete("/categories/:id", validate({ params: idParamsSchema }), controller.deleteCategory);

inventoryRouter.get("/vendors", controller.listVendors);
inventoryRouter.post("/vendors", validate({ body: vendorSchema }), controller.createVendor);
inventoryRouter.patch("/vendors/:id", validate({ params: idParamsSchema, body: vendorSchema }), controller.updateVendor);
inventoryRouter.delete("/vendors/:id", validate({ params: idParamsSchema }), controller.deleteVendor);

inventoryRouter.get("/transactions", validate({ query: transactionsQuerySchema }), controller.listTransactions);

inventoryRouter.get("/items", validate({ query: itemsQuerySchema }), controller.listItems);
inventoryRouter.post("/items", validate({ body: itemSchema }), controller.createItem);
inventoryRouter.get("/items/:id", validate({ params: idParamsSchema }), controller.getItem);
inventoryRouter.patch("/items/:id", validate({ params: idParamsSchema, body: itemSchema }), controller.updateItem);
inventoryRouter.delete("/items/:id", validate({ params: idParamsSchema }), controller.deleteItem);
inventoryRouter.post("/items/:id/transactions", validate({ params: idParamsSchema, body: transactionSchema }), controller.recordTransaction);
