import { Router } from "express";
import { getDiscoveryProfilesController } from "../controllers/discoveryController.js";

const discoveryRouter = Router();

discoveryRouter.get("/", getDiscoveryProfilesController);

export default discoveryRouter;
