import { Request, Response, Router } from "express";
import {
  addAdminUser,
  addApprover,
  addCatalogItem,
  createWorkflowStepTemplate,
  createRequestType,
  addUserRole,
  getDepartments,
  getUserRoles,
  isAdminUser,
  listAdminUsers,
  listApprovedMobileLineRequests,
  listApprovers,
  listCatalogItems,
  listRequestTypes,
  listUserRoles,
  listWorkflowStepTemplates,
  moveApprover,
  reorderApprovers,
  removeApprover,
  removeRequestType,
  removeWorkflowStepTemplate,
  setApproverAssignmentRole,
  updateApprover,
  updateCatalogItem,
  updateRequestType,
  updateRequestTypeWorkflow,
  updateWorkflowStepTemplate
} from "../services/workflow";

export const catalogRouter = Router();

async function assertAdminActor(req: Request, res: Response) {
  const actorEmail = String(req.query.actorEmail ?? "");

  if (!actorEmail) {
    res.status(400).json({ message: "El actor es requerido" });
    return null;
  }

  const actorIsAdmin = await isAdminUser(actorEmail);

  if (!actorIsAdmin) {
    res.status(403).json({ message: "Solo un administrador puede acceder a este recurso" });
    return null;
  }

  return actorEmail.toLowerCase();
}

catalogRouter.get("/catalog", async (_req, res, next) => {
  try {
    const [requestTypes, departments, approvers] = await Promise.all([
      listRequestTypes(),
      getDepartments(),
      listApprovers()
    ]);

    res.json({
      requestTypes,
      departments,
      approvers
    });
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/admins", async (_req, res, next) => {
  try {
    const actorEmail = await assertAdminActor(_req, res);

    if (!actorEmail) {
      return;
    }

    const admins = await listAdminUsers();
    res.json(admins);
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/admin/catalog-items", async (_req, res, next) => {
  try {
    const actorEmail = await assertAdminActor(_req, res);

    if (!actorEmail) {
      return;
    }

    const items = await listCatalogItems();
    res.json(items);
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/admin/mobile-lines", async (_req, res, next) => {
  try {
    const actorEmail = await assertAdminActor(_req, res);

    if (!actorEmail) {
      return;
    }

    const requests = await listApprovedMobileLineRequests();
    res.json(requests);
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/admin/user-roles", async (_req, res, next) => {
  try {
    const actorEmail = await assertAdminActor(_req, res);

    if (!actorEmail) {
      return;
    }

    const roles = await listUserRoles();
    res.json(roles);
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/admin/approvers", async (_req, res, next) => {
  try {
    const actorEmail = await assertAdminActor(_req, res);

    if (!actorEmail) {
      return;
    }

    const approvers = await listApprovers();
    res.json(approvers);
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/admin/workflow-steps", async (_req, res, next) => {
  try {
    const actorEmail = await assertAdminActor(_req, res);

    if (!actorEmail) {
      return;
    }

    const steps = await listWorkflowStepTemplates();
    res.json(steps);
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/users/roles", async (req, res, next) => {
  try {
    const email = String(req.query.email ?? "");

    if (!email) {
      res.status(400).json({ message: "El correo es requerido" });
      return;
    }

    const roles = await getUserRoles(email);
    res.json(roles);
  } catch (error) {
    next(error);
  }
});

catalogRouter.get("/admins/check", async (req, res, next) => {
  try {
    const email = String(req.query.email ?? "");

    if (!email) {
      res.status(400).json({ message: "El correo es requerido" });
      return;
    }

    const isAdmin = await isAdminUser(email);
    res.json({ isAdmin });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/admins", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede agregar otros administradores" });
      return;
    }

    const targetEmail = String(body.email ?? "").toLowerCase();
    const targetName = String(body.fullName ?? "");

    if (!targetEmail || !targetName) {
      res.status(400).json({ message: "Nombre y correo son requeridos" });
      return;
    }

    const created = await addAdminUser({
      fullName: targetName,
      email: targetEmail,
      createdByEmail: actorEmail.toLowerCase()
    });

    const admins = await listAdminUsers();

    res.status(201).json({
      created,
      admins
    });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/admin/user-roles", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede asignar roles" });
      return;
    }

    const targetEmail = String(body.email ?? "").toLowerCase();
    const targetName = String(body.fullName ?? "");
    const roleCode = String(body.roleCode ?? "").toUpperCase();

    if (!targetEmail || !targetName || !roleCode) {
      res.status(400).json({ message: "Nombre, correo y rol son requeridos" });
      return;
    }

    const created = await addUserRole({
      fullName: targetName,
      email: targetEmail,
      roleCode,
      createdByEmail: actorEmail.toLowerCase()
    });

    const roles = await listUserRoles();

    res.status(201).json({
      created,
      roles
    });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/admin/catalog-items", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede modificar catalogos" });
      return;
    }

    const catalogKey = String(body.catalogKey ?? "");
    const itemLabel = String(body.itemLabel ?? "");
    const itemValue = String(body.itemValue ?? "");
    const sortOrder = Number(body.sortOrder ?? 999);

    if (!catalogKey || !itemLabel || !itemValue) {
      res.status(400).json({ message: "Catalogo, etiqueta y valor son requeridos" });
      return;
    }

    const created = await addCatalogItem({
      catalogKey,
      itemLabel,
      itemValue,
      sortOrder
    });

    const items = await listCatalogItems();

    res.status(201).json({
      created,
      items
    });
  } catch (error) {
    next(error);
  }
});

catalogRouter.patch("/admin/catalog-items/:id", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede modificar catalogos" });
      return;
    }

    const catalogKey = String(body.catalogKey ?? "");
    const itemLabel = String(body.itemLabel ?? "");
    const itemValue = String(body.itemValue ?? "");
    const sortOrder = Number(body.sortOrder ?? 999);

    if (!catalogKey || !itemLabel || !itemValue) {
      res.status(400).json({ message: "Catalogo, etiqueta y valor son requeridos" });
      return;
    }

    const updated = await updateCatalogItem({
      id: req.params.id,
      catalogKey,
      itemLabel,
      itemValue,
      sortOrder
    });

    const items = await listCatalogItems();

    res.json({
      updated,
      items
    });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/admin/request-types", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede crear tipos de solicitud" });
      return;
    }

    const code = String(body.code ?? "");
    const name = String(body.name ?? "");
    const description = String(body.description ?? "");
    const category = String(body.category ?? "");
    const themeColor = String(body.themeColor ?? "");

    if (!code || !name || !description || !category || !themeColor) {
      res.status(400).json({ message: "Codigo, nombre, descripcion, categoria y color son requeridos" });
      return;
    }

    const created = await createRequestType({
      code,
      name,
      description,
      category,
      themeColor
    });

    const requestTypes = await listRequestTypes();
    res.status(201).json({ created, requestTypes });
  } catch (error) {
    next(error);
  }
});

catalogRouter.patch("/admin/request-types/:id", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede modificar tipos de solicitud" });
      return;
    }

    const name = String(body.name ?? "");
    const description = String(body.description ?? "");
    const category = String(body.category ?? "");
    const themeColor = String(body.themeColor ?? "");

    if (!name || !description || !category || !themeColor) {
      res.status(400).json({ message: "Nombre, descripcion, categoria y color son requeridos" });
      return;
    }

    const updated = await updateRequestType({
      id: req.params.id,
      name,
      description,
      category,
      themeColor
    });

    const requestTypes = await listRequestTypes();
    res.json({ updated, requestTypes });
  } catch (error) {
    next(error);
  }
});

catalogRouter.delete("/admin/request-types/:id", async (req, res, next) => {
  try {
    const actorEmail = String(req.query.actorEmail ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede eliminar tipos de solicitud" });
      return;
    }

    const removed = await removeRequestType(req.params.id);
    const requestTypes = await listRequestTypes();
    res.json({ removed, requestTypes });
  } catch (error) {
    next(error);
  }
});

catalogRouter.patch("/admin/request-types/:id/workflow", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");
    const stepCodes = Array.isArray(body.stepCodes) ? body.stepCodes.map((item) => String(item)) : [];

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede modificar workflows" });
      return;
    }

    if (stepCodes.length === 0) {
      res.status(400).json({ message: "Debes mantener al menos un paso en el workflow" });
      return;
    }

    const updated = await updateRequestTypeWorkflow({
      id: req.params.id,
      stepCodes
    });

    const requestTypes = await listRequestTypes();

    res.json({
      updated,
      requestTypes
    });
  } catch (error) {
    next(error);
  }
});

catalogRouter.patch("/admin/workflow-steps/:id", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede modificar pasos" });
      return;
    }

    const label = String(body.label ?? "");
    const description = String(body.description ?? "");
    const active = Boolean(body.active);
    const sortOrder = Number(body.sortOrder ?? 999);
    const responsibleName = String(body.responsibleName ?? "");
    const responsibleEmail = String(body.responsibleEmail ?? "");
    const responsibleTitle = String(body.responsibleTitle ?? "");
    const clearResponsible = Boolean(body.clearResponsible);

    if (!label || !description) {
      res.status(400).json({ message: "Etiqueta y descripcion son requeridas" });
      return;
    }

    const updated = await updateWorkflowStepTemplate({
      id: req.params.id,
      label,
      description,
      active,
      sortOrder,
      responsibleName,
      responsibleEmail,
      responsibleTitle,
      clearResponsible
    });

    const steps = await listWorkflowStepTemplates();

    res.json({
      updated,
      steps
    });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/admin/workflow-steps", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede crear pasos" });
      return;
    }

    const code = String(body.code ?? "");
    const label = String(body.label ?? "");
    const description = String(body.description ?? "");
    const kind = String(body.kind ?? "") as "approval" | "fulfillment";
    const routing = String(body.routing ?? "") as "department" | "scope";
    const scope = body.scope ? String(body.scope) : null;
    const sortOrder = Number(body.sortOrder ?? 999);
    const responsibleName = String(body.responsibleName ?? "");
    const responsibleEmail = String(body.responsibleEmail ?? "");
    const responsibleTitle = String(body.responsibleTitle ?? "");

    if (!code || !label || !description || !kind || !routing) {
      res.status(400).json({ message: "Codigo, etiqueta, descripcion, tipo y ruteo son requeridos" });
      return;
    }

    const created = await createWorkflowStepTemplate({
      code,
      label,
      description,
      kind,
      routing,
      scope,
      sortOrder,
      responsibleName,
      responsibleEmail,
      responsibleTitle
    });

    const steps = await listWorkflowStepTemplates();

    res.status(201).json({
      created,
      steps
    });
  } catch (error) {
    next(error);
  }
});

catalogRouter.delete("/admin/workflow-steps/:id", async (req, res, next) => {
  try {
    const actorEmail = String(req.query.actorEmail ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede eliminar pasos" });
      return;
    }

    await removeWorkflowStepTemplate(req.params.id);
    const [steps, requestTypes] = await Promise.all([listWorkflowStepTemplates(), listRequestTypes()]);
    res.json({ steps, requestTypes });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/admin/approvers", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede modificar aprobadores" });
      return;
    }

    const fullName = String(body.fullName ?? "");
    const email = String(body.email ?? "");
    const title = String(body.title ?? "");
    const scope = String(body.scope ?? "");
    const roleCode = String(body.roleCode ?? "");
    const department = body.department ? String(body.department) : null;
    const assignmentRole = body.assignmentRole ? String(body.assignmentRole) : "PRIMARY";

    if (!fullName || !email || !title || !scope || !roleCode) {
      res.status(400).json({ message: "Nombre, correo, cargo, alcance y rol son requeridos" });
      return;
    }

    const created = await addApprover({
      department,
      scope,
      roleCode,
      fullName,
      email,
      title,
      assignmentRole
    });

    const approvers = await listApprovers();
    res.status(201).json({ created, approvers });
  } catch (error) {
    next(error);
  }
});

catalogRouter.patch("/admin/approvers/:id", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede modificar aprobadores" });
      return;
    }

    const fullName = String(body.fullName ?? "");
    const email = String(body.email ?? "");
    const title = String(body.title ?? "");
    const assignmentRole = body.assignmentRole ? String(body.assignmentRole) : undefined;

    if (!fullName || !email || !title) {
      res.status(400).json({ message: "Nombre, correo y cargo son requeridos" });
      return;
    }

    const updated = await updateApprover({
      id: req.params.id,
      fullName,
      email,
      title,
      assignmentRole
    });

    const approvers = await listApprovers();
    res.json({ updated, approvers });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/admin/approvers/:id/move", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");
    const direction = String(body.direction ?? "").toLowerCase();

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede reordenar aprobadores" });
      return;
    }

    if (direction !== "up" && direction !== "down") {
      res.status(400).json({ message: "La direccion es invalida" });
      return;
    }

    const updated = await moveApprover({
      id: req.params.id,
      direction
    });

    const approvers = await listApprovers();
    res.json({ updated, approvers });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/admin/approvers/:id/assignment-role", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");
    const assignmentRole = String(body.assignmentRole ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede modificar responsables" });
      return;
    }

    if (!assignmentRole) {
      res.status(400).json({ message: "El rol de asignacion es requerido" });
      return;
    }

    const updated = await setApproverAssignmentRole({
      id: req.params.id,
      assignmentRole
    });

    const approvers = await listApprovers();
    res.json({ updated, approvers });
  } catch (error) {
    next(error);
  }
});

catalogRouter.delete("/admin/approvers/:id", async (req, res, next) => {
  try {
    const actorEmail = String(req.query.actorEmail ?? "");

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede eliminar aprobadores" });
      return;
    }

    await removeApprover(req.params.id);
    const approvers = await listApprovers();
    res.json({ approvers });
  } catch (error) {
    next(error);
  }
});

catalogRouter.post("/admin/approvers/reorder", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const actorEmail = String(body.actorEmail ?? "");
    const ids = Array.isArray(body.ids) ? body.ids.map((item) => String(item)) : [];

    if (!actorEmail) {
      res.status(400).json({ message: "El actor es requerido" });
      return;
    }

    const actorIsAdmin = await isAdminUser(actorEmail);

    if (!actorIsAdmin) {
      res.status(403).json({ message: "Solo un administrador puede reordenar aprobadores" });
      return;
    }

    if (ids.length === 0) {
      res.status(400).json({ message: "Debes enviar una lista de aprobadores" });
      return;
    }

    const approvers = await reorderApprovers(ids);
    res.json({ approvers });
  } catch (error) {
    next(error);
  }
});
