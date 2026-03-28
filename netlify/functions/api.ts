import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

/**
 * Lightweight Netlify Function that serves API health-check and basic info.
 *
 * For the full NestJS API, set all required environment variables in the
 * Netlify dashboard (DATABASE_URL, REDIS_URL, JWT_SECRET, etc.) and replace
 * this handler with the serverless-express adapter (see README).
 */
const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  const path = event.path.replace(/^\/?\.netlify\/functions\/api\/?/, "/").replace(/^\/api\//, "/") || "/";
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-workspace-id, x-api-key",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // Health endpoint
  if (path === "/health" || path === "/") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "0.1.0",
        service: "relayflow-api",
        environment: process.env.NODE_ENV || "production",
      }),
    };
  }

  // Swagger docs redirect
  if (path === "/docs" || path === "/api/docs") {
    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "text/html" },
      body: `<!DOCTYPE html>
<html>
<head><title>RelayFlow API Docs</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#f1f5f9">
<div style="text-align:center;max-width:480px">
<h1>📖 RelayFlow API</h1>
<p>La documentation Swagger est disponible lorsque l'API NestJS complète est déployée.</p>
<p style="margin-top:1rem"><a href="/" style="color:#3b82f6">← Retour à l'accueil</a></p>
</div>
</body>
</html>`,
    };
  }

  // All other routes – return 404 with helpful message
  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${event.httpMethod} ${path} not found`,
        hint: "Configure the full NestJS API with DATABASE_URL, REDIS_URL and JWT_SECRET environment variables for full functionality.",
      },
    }),
  };
};

export { handler };
