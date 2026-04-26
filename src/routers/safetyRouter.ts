import { Router } from "express";
import {
  blockUserController,
  deleteMyAccountController,
  getBlockedUsersController,
  unblockUserController,
  unmatchUserController,
} from "../controllers/safetyController.js";

const safetyRouter = Router();

safetyRouter.get("/blocked-users", getBlockedUsersController);
safetyRouter.delete("/delete-account", deleteMyAccountController);
safetyRouter.post("/block", blockUserController);
safetyRouter.post("/unblock", unblockUserController);
safetyRouter.post("/matches/:matchId/unmatch", unmatchUserController);

export default safetyRouter;
