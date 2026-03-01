import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Gym Platform API",
      version: "1.0.0",
      description: "CRUD and dashboard APIs for admin and gym owner users.",
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
      },
      headers: {
        XRequestId: {
          description: "Unique request correlation id.",
          schema: { type: "string" },
        },
        XResponseTime: {
          description: "Server-side processing latency in milliseconds.",
          schema: { type: "string", example: "24ms" },
        },
        XEnvironment: {
          description: "Environment that produced this response.",
          schema: { type: "string", example: "development" },
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
                  field: { type: "string", example: "planName" },
                  message: { type: "string", example: "Plan name is required" },
                },
              },
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: "Authentication failed.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ApiErrorEnvelope",
              },
            },
          },
        },
        ForbiddenError: {
          description: "Insufficient permission.",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ApiErrorEnvelope",
              },
            },
          },
        },
      },
    },
  },
  apis: ["src/routes/*.ts"],
});
