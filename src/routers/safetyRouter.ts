import { Router } from "express";
import {
  blockUserController,
  deleteMyAccountController,
  unblockUserController,
  unmatchUserController,
} from "../controllers/safetyController.js";

const safetyRouter = Router();

safetyRouter.delete("/delete-account", deleteMyAccountController);
safetyRouter.post("/block", blockUserController);
safetyRouter.post("/unblock", unblockUserController);
safetyRouter.post("/matches/:matchId/unmatch", unmatchUserController);

export default safetyRouter;
