import type { Request } from "express";

type OpenApiDocument = Record<string, unknown>;

function getRequestBaseUrl(req: Request) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  return `${protocol}://${req.get("host")}`;
}

export function buildOpenApiDocument(req: Request): OpenApiDocument {
  const baseUrl = getRequestBaseUrl(req);

  return {
    openapi: "3.1.0",
    info: {
      title: "SSD API",
      version: "1.0.0",
      description: "Contrato API del Sistema de Solicitudes Digital (SSD)."
    },
    servers: [
      {
        url: baseUrl,
        description: "Servidor actual"
      }
    ],
    tags: [
      { name: "Health", description: "Estado del servicio" },
      { name: "Catalog", description: "Catálogo público y perfil de acceso" },
      { name: "Requests", description: "Solicitudes y aprobaciones" },
      { name: "Dashboard", description: "Métricas operativas" },
      { name: "Admin", description: "Administración del sistema" }
    ],
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: {
            "200": {
              description: "Servicio activo"
            }
          }
        }
      },
      "/api/catalog": {
        get: {
          tags: ["Catalog"],
          summary: "Obtiene tipos de solicitud, departamentos y aprobadores",
          responses: {
            "200": {
              description: "Catálogo cargado",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["requestTypes", "departments", "approvers"],
                    properties: {
                      requestTypes: { type: "array", items: { $ref: "#/components/schemas/RequestType" } },
                      departments: { type: "array", items: { type: "string" } },
                      approvers: { type: "array", items: { $ref: "#/components/schemas/Approver" } }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/dashboard": {
        get: {
          tags: ["Dashboard"],
          summary: "Obtiene métricas del dashboard",
          parameters: [
            {
              in: "query",
              name: "actorEmail",
              schema: { type: "string", format: "email" },
              required: false,
              description: "Correo del usuario para aplicar visibilidad"
            }
          ],
          responses: {
            "200": {
              description: "Métricas del dashboard",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DashboardResponse" }
                }
              }
            }
          }
        }
      },
      "/api/requests": {
        get: {
          tags: ["Requests"],
          summary: "Lista solicitudes visibles para el actor",
          parameters: [
            {
              in: "query",
              name: "requesterEmail",
              schema: { type: "string", format: "email" },
              required: false
            },
            {
              in: "query",
              name: "actorEmail",
              schema: { type: "string", format: "email" },
              required: false
            }
          ],
          responses: {
            "200": {
              description: "Listado de solicitudes",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/RequestItem" }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ["Requests"],
          summary: "Crea una nueva solicitud",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateRequestInput" }
              }
            }
          },
          responses: {
            "201": {
              description: "Solicitud creada",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["id", "ticketCode"],
                    properties: {
                      id: { type: "string", format: "uuid" },
                      ticketCode: { type: "string" }
                    }
                  }
                }
              }
            },
            "400": {
              $ref: "#/components/responses/BadRequest"
            }
          }
        }
      },
      "/api/requests/inbox": {
        get: {
          tags: ["Requests"],
          summary: "Bandeja de pendientes por aprobador",
          parameters: [
            {
              in: "query",
              name: "email",
              required: true,
              schema: { type: "string", format: "email" }
            }
          ],
          responses: {
            "200": {
              description: "Pendientes del aprobador",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/PendingApprovalItem" }
                  }
                }
              }
            },
            "400": {
              $ref: "#/components/responses/BadRequest"
            }
          }
        }
      },
      "/api/requests/{id}": {
        get: {
          tags: ["Requests"],
          summary: "Detalle de solicitud",
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" }
            },
            {
              in: "query",
              name: "actorEmail",
              required: false,
              schema: { type: "string", format: "email" }
            }
          ],
          responses: {
            "200": {
              description: "Detalle de solicitud",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RequestDetail" }
                }
              }
            },
            "404": {
              $ref: "#/components/responses/NotFound"
            }
          }
        }
      },
      "/api/requests/{id}/steps/{stepId}/decision": {
        post: {
          tags: ["Requests"],
          summary: "Registra decisión de un paso",
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" }
            },
            {
              in: "path",
              name: "stepId",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["decision", "actorName", "actorEmail"],
                  properties: {
                    decision: { type: "string", enum: ["approve", "reject", "complete"] },
                    comments: { type: "string" },
                    actorName: { type: "string" },
                    actorEmail: { type: "string", format: "email" }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Solicitud actualizada",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RequestDetail" }
                }
              }
            },
            "400": {
              $ref: "#/components/responses/BadRequest"
            }
          }
        }
      },
      "/api/admin/workflow-steps": {
        get: {
          tags: ["Admin"],
          summary: "Lista pasos de workflow",
          parameters: [
            {
              in: "query",
              name: "actorEmail",
              required: true,
              schema: { type: "string", format: "email" }
            }
          ],
          responses: {
            "200": {
              description: "Listado de pasos",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/WorkflowStep" }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ["Admin"],
          summary: "Crea un paso de workflow",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["actorEmail", "code", "label", "description", "kind", "routing"],
                  properties: {
                    actorEmail: { type: "string", format: "email" },
                    code: { type: "string" },
                    label: { type: "string" },
                    description: { type: "string" },
                    kind: { type: "string", enum: ["approval", "fulfillment"] },
                    routing: { type: "string", enum: ["department", "scope"] },
                    scope: { type: "string", nullable: true },
                    sortOrder: { type: "integer" },
                    responsibleName: { type: "string" },
                    responsibleEmail: { type: "string", format: "email" },
                    responsibleTitle: { type: "string" }
                  }
                }
              }
            }
          },
          responses: {
            "201": {
              description: "Paso creado"
            },
            "400": {
              $ref: "#/components/responses/BadRequest"
            }
          }
        }
      },
      "/api/admin/workflow-steps/{id}": {
        patch: {
          tags: ["Admin"],
          summary: "Actualiza un paso de workflow",
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["actorEmail", "label", "description", "active", "sortOrder"],
                  properties: {
                    actorEmail: { type: "string", format: "email" },
                    label: { type: "string" },
                    description: { type: "string" },
                    active: { type: "boolean" },
                    sortOrder: { type: "integer" },
                    responsibleName: { type: "string" },
                    responsibleEmail: { type: "string", format: "email" },
                    responsibleTitle: { type: "string" },
                    clearResponsible: { type: "boolean" }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Paso actualizado"
            },
            "400": {
              $ref: "#/components/responses/BadRequest"
            }
          }
        },
        delete: {
          tags: ["Admin"],
          summary: "Elimina un paso de workflow",
          parameters: [
            {
              in: "path",
              name: "id",
              required: true,
              schema: { type: "string", format: "uuid" }
            },
            {
              in: "query",
              name: "actorEmail",
              required: true,
              schema: { type: "string", format: "email" }
            }
          ],
          responses: {
            "200": {
              description: "Paso eliminado"
            },
            "400": {
              $ref: "#/components/responses/BadRequest"
            }
          }
        }
      }
    },
    components: {
      responses: {
        BadRequest: {
          description: "Error de validación o negocio",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" }
            }
          }
        },
        NotFound: {
          description: "No encontrado",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" }
            }
          }
        }
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string" }
          }
        },
        Approver: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            department: { type: "string", nullable: true },
            scope: { type: "string" },
            role_code: { type: "string" },
            full_name: { type: "string" },
            email: { type: "string", format: "email" },
            title: { type: "string" },
            assignment_role: { type: "string" },
            sort_order: { type: "integer" }
          }
        },
        RequestType: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            code: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            theme_color: { type: "string" },
            fields: { type: "array", items: { type: "object" } },
            workflow: { type: "object" },
            requires_general_management: { type: "boolean" },
            active: { type: "boolean" }
          }
        },
        RequestItem: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            ticket_code: { type: "string" },
            status: { type: "string" },
            requester_name: { type: "string" },
            requester_email: { type: "string", format: "email" },
            department: { type: "string" },
            beneficiary_name: { type: "string", nullable: true },
            subject: { type: "string" },
            justification: { type: "string" },
            payload: { type: "object", additionalProperties: true },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
            request_type_code: { type: "string" },
            request_type_name: { type: "string" },
            category: { type: "string" }
          }
        },
        RequestStep: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            sequence: { type: "integer" },
            role_code: { type: "string" },
            label: { type: "string" },
            kind: { type: "string", enum: ["approval", "fulfillment"] },
            approver_name: { type: "string" },
            approver_email: { type: "string", format: "email" },
            department: { type: "string", nullable: true },
            status: { type: "string" },
            decision: { type: "string", nullable: true },
            comments: { type: "string", nullable: true },
            acted_at: { type: "string", format: "date-time", nullable: true },
            metadata: { type: "object", additionalProperties: true }
          }
        },
        RequestEvent: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            event_type: { type: "string" },
            actor_name: { type: "string" },
            actor_email: { type: "string", format: "email" },
            notes: { type: "string" },
            payload: { type: "object", additionalProperties: true },
            created_at: { type: "string", format: "date-time" }
          }
        },
        RequestDetail: {
          allOf: [
            { $ref: "#/components/schemas/RequestItem" },
            {
              type: "object",
              properties: {
                steps: {
                  type: "array",
                  items: { $ref: "#/components/schemas/RequestStep" }
                },
                events: {
                  type: "array",
                  items: { $ref: "#/components/schemas/RequestEvent" }
                }
              }
            }
          ]
        },
        PendingApprovalItem: {
          allOf: [
            { $ref: "#/components/schemas/RequestItem" },
            {
              type: "object",
              properties: {
                step_id: { type: "string", format: "uuid" },
                step_label: { type: "string" },
                step_kind: { type: "string", enum: ["approval", "fulfillment"] },
                step_sequence: { type: "integer" },
                approver_name: { type: "string" },
                approver_email: { type: "string", format: "email" },
                step_status: { type: "string" },
                step_created_at: { type: "string", format: "date-time" }
              }
            }
          ]
        },
        DashboardResponse: {
          type: "object",
          required: ["metrics", "byType", "pendingByApprover", "recentRequests"],
          properties: {
            metrics: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  total: { type: "string" }
                }
              }
            },
            byType: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  total: { type: "string" }
                }
              }
            },
            pendingByApprover: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  approver_name: { type: "string" },
                  pending: { type: "string" }
                }
              }
            },
            recentRequests: {
              type: "array",
              items: { $ref: "#/components/schemas/RequestItem" }
            }
          }
        },
        WorkflowStep: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            code: { type: "string" },
            label: { type: "string" },
            description: { type: "string" },
            kind: { type: "string", enum: ["approval", "fulfillment"] },
            routing: { type: "string", enum: ["department", "scope"] },
            scope: { type: "string", nullable: true },
            sort_order: { type: "integer" },
            active: { type: "boolean" },
            responsible_name: { type: "string", nullable: true },
            responsible_email: { type: "string", format: "email", nullable: true },
            responsible_title: { type: "string", nullable: true }
          }
        },
        CreateRequestInput: {
          type: "object",
          required: [
            "requestTypeCode",
            "requesterName",
            "requesterEmail",
            "department",
            "subject",
            "justification",
            "payload"
          ],
          properties: {
            requestTypeCode: { type: "string" },
            requesterName: { type: "string" },
            requesterEmail: { type: "string", format: "email" },
            requesterManagerEmail: { type: "string", format: "email" },
            requesterManagerName: { type: "string" },
            requesterManagerTitle: { type: "string" },
            department: { type: "string" },
            beneficiaryName: { type: "string" },
            subject: { type: "string" },
            justification: { type: "string" },
            payload: { type: "object", additionalProperties: true }
          }
        }
      }
    }
  };
}

export function renderSwaggerHtml(openApiJsonPath = "/api/openapi.json") {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SSD API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f4f8fc; }
      #swagger-ui { max-width: 1200px; margin: 0 auto; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "${openApiJsonPath}",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true
      });
    </script>
  </body>
</html>`;
}
