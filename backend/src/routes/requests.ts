import { Router } from "express";
import { actOnStep, createRequest, getApproverProfile, getRequestById, listPendingApprovals, listRequests } from "../services/workflow";

export const requestsRouter = Router();

requestsRouter.get("/requests", async (req, res, next) => {
  try {
    const requesterEmail = typeof req.query.requesterEmail === "string" ? req.query.requesterEmail : undefined;
    const actorEmail = typeof req.query.actorEmail === "string" ? req.query.actorEmail : undefined;
    const requests = await listRequests(requesterEmail, actorEmail);
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

requestsRouter.get("/requests/inbox", async (req, res, next) => {
  try {
    const approverEmail = String(req.query.email ?? "");

    if (!approverEmail) {
      res.status(400).json({ message: "El correo del aprobador es requerido" });
      return;
    }

    const requests = await listPendingApprovals(approverEmail);
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

requestsRouter.get("/approvers/profile", async (req, res, next) => {
  try {
    const approverEmail = String(req.query.email ?? "");

    if (!approverEmail) {
      res.status(400).json({ message: "El correo del aprobador es requerido" });
      return;
    }

    const profile = await getApproverProfile(approverEmail);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

requestsRouter.get("/requests/:id", async (req, res, next) => {
  try {
    const actorEmail = typeof req.query.actorEmail === "string" ? req.query.actorEmail : undefined;
    const request = await getRequestById(req.params.id, actorEmail);

    if (!request) {
      res.status(404).json({ message: "Solicitud no encontrada" });
      return;
    }

    res.json(request);
  } catch (error) {
    next(error);
  }
});

requestsRouter.post("/requests", async (req, res, next) => {
  try {
    const payload = req.body as Record<string, unknown>;

    const result = await createRequest({
      requestTypeCode: String(payload.requestTypeCode ?? ""),
      requesterName: String(payload.requesterName ?? ""),
      requesterEmail: String(payload.requesterEmail ?? ""),
      requesterManagerEmail: payload.requesterManagerEmail ? String(payload.requesterManagerEmail) : undefined,
      requesterManagerName: payload.requesterManagerName ? String(payload.requesterManagerName) : undefined,
      requesterManagerTitle: payload.requesterManagerTitle ? String(payload.requesterManagerTitle) : undefined,
      department: String(payload.department ?? ""),
      beneficiaryName: payload.beneficiaryName ? String(payload.beneficiaryName) : undefined,
      subject: String(payload.subject ?? ""),
      justification: String(payload.justification ?? ""),
      payload: (payload.payload as Record<string, unknown>) ?? {}
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

requestsRouter.post("/requests/:id/steps/:stepId/decision", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;

    const result = await actOnStep(req.params.id, req.params.stepId, {
      decision: body.decision as "approve" | "reject" | "complete",
      comments: body.comments ? String(body.comments) : undefined,
      actorName: String(body.actorName ?? "Sistema"),
      actorEmail: String(body.actorEmail ?? "sistema@ssd.local")
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});
