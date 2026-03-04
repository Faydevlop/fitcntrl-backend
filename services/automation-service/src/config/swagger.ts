import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env";

type SwaggerParameter = {
  $ref?: string;
  in?: string;
  name?: string;
  description?: string;
  required?: boolean;
  schema?: unknown;
};

type SwaggerOperation = {
  parameters?: SwaggerParameter[];
  security?: Array<Record<string, string[]>>;
};

type SwaggerSpec = {
  paths?: Record<string, Record<string, unknown>>;
  components?: {
    parameters?: Record<string, SwaggerParameter>;
  };
};

const swaggerSpec = swaggerJSDoc({
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
}) as SwaggerSpec;

const operationMethods = new Set(["get", "put", "post", "delete", "patch", "options", "head", "trace"]);
const publicOperations = new Set([
  "get /api/whatsapp/webhook",
  "post /api/whatsapp/webhook",
]);

const hasHeaderParameter = (
  operation: SwaggerOperation,
  spec: SwaggerSpec,
  headerName: string,
): boolean => {
  const expected = headerName.toLowerCase();
  for (const parameter of operation.parameters ?? []) {
    if (parameter.$ref) {
      const parameterName = parameter.$ref.split("/").pop();
      const resolved = parameterName ? spec.components?.parameters?.[parameterName] : undefined;
      if (resolved?.in === "header" && resolved.name?.toLowerCase() === expected) {
        return true;
      }
      continue;
    }
    if (parameter.in === "header" && parameter.name?.toLowerCase() === expected) {
      return true;
    }
  }
  return false;
};

const hasSecurityScheme = (operation: SwaggerOperation, schemeName: string): boolean => {
  for (const requirement of operation.security ?? []) {
    if (schemeName in requirement) {
      return true;
    }
  }
  return false;
};

const ensureHeaderOnAllRoutes = (spec: SwaggerSpec): void => {
  spec.components ??= {};
  spec.components.parameters ??= {};

  spec.components.parameters.XDemoDbHeader ??= {
    in: "header",
    name: "x-demodb",
    required: false,
    description: "Use demo database. Allowed values: true or false.",
    schema: {
      type: "string",
      enum: ["true", "false"],
      default: "false",
    },
  };

  for (const [pathKey, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!operationMethods.has(method)) {
        continue;
      }

      const op = operation as SwaggerOperation;
      op.parameters ??= [];

      if (!hasHeaderParameter(op, spec, "x-demodb")) {
        op.parameters.push({ $ref: "#/components/parameters/XDemoDbHeader" });
      }
      if (!publicOperations.has(`${method} ${pathKey}`) && !hasSecurityScheme(op, "bearerAuth")) {
        op.security = [...(op.security ?? []), { bearerAuth: [] }];
      }
    }
  }
};

ensureHeaderOnAllRoutes(swaggerSpec);

export { swaggerSpec };
