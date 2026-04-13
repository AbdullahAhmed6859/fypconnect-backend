import express from "express";
import { protect } from "../middleware/auth";
import {
  getMyProfileController,
  updateMyProfileController,
} from "../controllers/profileController.js";

const profileRouter = express.Router();

profileRouter.get("/me", protect, getMyProfileController);
profileRouter.patch("/me", protect, updateMyProfileController);

export default profileRouter;