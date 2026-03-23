import { Router } from "express";
import { getDashboardData } from "../services/workflow";

export const dashboardRouter = Router();

dashboardRouter.get("/dashboard", async (req, res, next) => {
  try {
    const actorEmail = typeof req.query.actorEmail === "string" ? req.query.actorEmail : undefined;
    const dashboard = await getDashboardData(actorEmail);
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});
