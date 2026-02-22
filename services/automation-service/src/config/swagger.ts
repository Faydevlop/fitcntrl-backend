import swaggerJSDoc from "swagger-jsdoc";

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
        url: "http://localhost:4001"
      }
    ]
  },
  apis: ["src/routes/*.ts"]
});
