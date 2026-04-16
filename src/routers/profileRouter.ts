import { setupProfile, getUserProfile, updateMyProfileController } from "../controllers/profileController.js";
import express from "express";
import { protect } from "../middleware/auth";
import { Router } from "express";

const profileRouter = Router();

profileRouter.post("/setup", setupProfile);
profileRouter.get("/me", getUserProfile);
profileRouter.patch("/update", protect, updateMyProfileController);

export default profileRouter;