import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { dashboardRouter } from "./routes/dashboard";
import { catalogRouter } from "./routes/catalog";
import { requestsRouter } from "./routes/requests";
import { buildOpenApiDocument, renderSwaggerHtml } from "./openapi";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    }
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ssd-backend"
  });
});

app.get("/api/openapi.json", (req, res) => {
  res.json(buildOpenApiDocument(req));
});

app.get("/api/docs", (_req, res) => {
  res.type("html").send(renderSwaggerHtml("/api/openapi.json"));
});

app.use("/api", catalogRouter);
app.use("/api", dashboardRouter);
app.use("/api", requestsRouter);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({
    message: error.message
  });
});

app.listen(env.port, () => {
  console.log(`SSD backend running on port ${env.port}`);
});
