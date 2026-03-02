import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Gym Automation API",
      version: "1.0.0",
      description: "Webhook and WhatsApp automation APIs.",
    },
    servers: [
      {
        url: `http://localhost:${env.port}`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        internalTokenAuth: {
          type: "apiKey",
          in: "header",
          name: "X-Internal-Token",
        },
      },
      headers: {
        XRequestId: {
          description: "Unique request correlation id.",
          schema: { type: "string" },
        },
        XResponseTime: {
          description: "Server-side processing latency in milliseconds.",
          schema: { type: "string", example: "18ms" },
        },
      },
      schemas: {
        ApiEnvelope: {
          type: "object",
          properties: {
            meta: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
              },
            },
            data: {},
          },
        },
        ApiErrorEnvelope: {
          type: "object",
          properties: {
            meta: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                message: { type: "string", example: "Validation failed" },
              },
            },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string", example: "memberId" },
                  message: { type: "string", example: "memberId is required" },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ["src/routes/*.ts"],
});
