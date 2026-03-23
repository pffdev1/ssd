import dotenv from "dotenv";

dotenv.config();

const required = ["DATABASE_URL"] as const;

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL as string,
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  appBaseUrl: (process.env.APP_BASE_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:3000").replace(/\/+$/, ""),
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "ssd@localhost",
  teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL ?? "",
  teamsChannelLabel: process.env.TEAMS_CHANNEL_LABEL ?? "SSD"
};
