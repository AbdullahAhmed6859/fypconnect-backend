import { setupProfile } from "../controllers/profileController.js";
import { Router } from "express";

const profileRouter = Router();

profileRouter.post("/setup", setupProfile);

export default profileRouter;