import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { ask } from "./chatbot.controller.js";

const chatbotRouter = Router();

chatbotRouter.post("/ask", requireAuth, ask);

export default chatbotRouter;
