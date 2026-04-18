import { Router } from "express";
import { getUpdatedProfileForMatchController } from "../controllers/matchNotifsController.js";
import { getActiveMatchesController } from "../controllers/matchController.js"


const matchesRouter = Router();

matchesRouter.get("/:matchId/updated-profile", getUpdatedProfileForMatchController);
matchesRouter.get("/matches", getActiveMatchesController);

export default matchesRouter;