import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Gym Automation API",
      version: "1.0.0",
      description: "Webhook and WhatsApp automation APIs."
    },
    servers: [
      {
        url: `http://localhost:${env.port}`
      }
    ],
    components: {
      securitySchemes: {
        internalTokenAuth: {
          type: "apiKey",
          in: "header",
          name: "X-Internal-Token"
        }
      },
      headers: {
        XRequestId: {
          description: "Unique request correlation id.",
          schema: { type: "string" }
        },
        XResponseTime: {
          description: "Server-side processing latency in milliseconds.",
          schema: { type: "string", example: "18ms" }
        }
      },
      schemas: {
        ApiEnvelope: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {}
          }
        }
      }
    }
  },
  apis: ["src/routes/*.ts"]
});
