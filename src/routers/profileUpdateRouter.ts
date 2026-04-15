import express from "express";
import { protect } from "../middleware/auth";
import {
  getMyProfileController,
  updateMyProfileController,
} from "../controllers/profileUpdateController.js";

const profileRouter = express.Router();

profileRouter.get("/me", protect, getMyProfileController);
profileRouter.patch("/me", protect, updateMyProfileController);

export default profileRouter;