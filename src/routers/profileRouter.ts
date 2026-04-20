import {
    setupProfile,
    getUserProfile,
    updateMyProfileController,
    getUserPreferences,
    updateUserPreferences,
} from "../controllers/profileController.js";
import { Router } from "express";

const profileRouter = Router();

profileRouter.post("/setup", setupProfile);
profileRouter.get("/me", getUserProfile);
profileRouter.patch("/update", updateMyProfileController);
profileRouter.get("/preferences", getUserPreferences);
profileRouter.put("/preferences", updateUserPreferences);

export default profileRouter;
