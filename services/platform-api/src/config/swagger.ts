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
        TableSearchItem: {
          type: "object",
          properties: {
            term: { type: "string" },
            fields: { type: "array", items: { type: "string" } },
            startsWith: { type: "boolean" },
            endsWith: { type: "boolean" },
          },
        },
        TableQueryOptions: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1, default: 1 },
            itemsPerPage: { type: "number", minimum: 1, default: 20 },
            sortBy: { type: "array", items: { type: "string" } },
            sortDesc: { type: "array", items: { type: "boolean" } },
          },
        },
        TableQueryRequest: {
          type: "object",
          properties: {
            projection: {
              type: "object",
              additionalProperties: { type: "number", enum: [0, 1] },
            },
            filters: {
              type: "object",
              additionalProperties: true,
            },
            search: {
              type: "array",
              items: { $ref: "#/components/schemas/TableSearchItem" },
            },
            options: { $ref: "#/components/schemas/TableQueryOptions" },
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
}) as SwaggerSpec;

const operationMethods = new Set(["get", "put", "post", "delete", "patch", "options", "head", "trace"]);
const publicOperations = new Set([
  "post /api/auth/login",
  "post /api/auth/signup",
  "post /api/auth/forgot-password",
  "post /api/auth/verify-code",
  "get /api/constants",
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
