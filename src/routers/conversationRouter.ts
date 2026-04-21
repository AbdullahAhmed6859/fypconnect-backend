import { Router } from "express";
import {
  getConversationController,
  sendMessageController,
} from "../controllers/conversationController.js";

const conversationRouter = Router();

conversationRouter.get("/conversations/:matchId", getConversationController);
conversationRouter.post("/conversations/:matchId/messages", sendMessageController);

export default conversationRouter;
