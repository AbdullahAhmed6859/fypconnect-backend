import { Router } from "express";
import {
  likeProfileController,
  passProfileController,
} from "../controllers/browseController.js";

const browseRouter = Router();

browseRouter.post("/like", likeProfileController);
browseRouter.post("/pass", passProfileController);

export default browseRouter;
