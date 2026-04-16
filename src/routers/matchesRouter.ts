import { Router } from "express";
import { getUpdatedProfileForMatchController } from "../controllers/matchNotifsController.js";


const matchesRouter = Router();

matchesRouter.get("/:matchId/updated-profile", getUpdatedProfileForMatchController);

export default matchesRouter;