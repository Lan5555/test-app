export const javascriptIntegrations = String.raw`
// Project endpoint dispatch. Connected services are supplied by the host.
function blueprintResponse(status, body) {
  if (!Number.isInteger(status) || status < 200 || status > 599) {
    throw new Error("HTTP Response needs an integer status from 200 to 599.");
  }
  return { status, body: [204, 205, 304].includes(status) ? null : body ?? null };
}

async function blueprintRequest(method, path, body) {
  if (!/^\/(?:[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)?$/.test(path) || path.length > 160) {
    throw new Error("Use a project endpoint path like /example.");
  }
  const matching = blueprintEndpoints.filter((endpoint) => endpoint.path === path);
  const target = matching.find((endpoint) => endpoint.method === method);
  if (!target) return { status: matching.length ? 405 : 404, body: null };
  return await target.handle(method, path, body ?? null) ?? { status: 204, body: null };
}

async function blueprintExternal(request) {
  if (typeof globalThis.blueprintHost !== "function") {
    throw new Error("Provide a blueprintHost function to run connected HTTP or AI nodes.");
  }
  const result = await globalThis.blueprintHost(request);
  if (request.kind === "ai" && typeof result !== "string") {
    throw new Error("The AI operation did not return text.");
  }
  return result;
}
`;

export const javascriptServer = String.raw`
// Run this export with Node.js and --serve [port] to try its endpoints locally.
async function blueprintServe() {
  const { createServer } = await import("node:http");
  const rawPort = process.argv[process.argv.indexOf("--serve") + 1];
  const port = rawPort === undefined ? 3000 : Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("Choose a port from 0 to 65535.");
  }
  const server = createServer({ requestTimeout: 10000, headersTimeout: 8000 }, async (request, reply) => {
    const send = (status, body) => {
      reply.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      reply.end([204, 205, 304].includes(status) ? undefined : JSON.stringify(body));
    };
    let size = 0;
    const chunks = [];
    try {
      const host = "127.0.0.1:" + server.address().port;
      if (request.headers.host !== host || (request.headers.origin && request.headers.origin !== "http://" + host)) {
        send(403, { error: "Use the local Blueprint address." });
        return;
      }
      for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        size += chunk.length;
        if (size > 8192) {
          send(413, { error: "Request bodies are limited to 8 KB." });
          return;
        }
        chunks.push(chunk);
      }
      let body = null;
      if (size) {
        if (!/^application\/json(?:;|$)/i.test(request.headers["content-type"] ?? "")) {
          send(415, { error: "Use Content-Type: application/json." });
          return;
        }
        try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
        catch { send(400, { error: "Use a valid JSON body." }); return; }
      }
      const path = new URL(request.url, "http://127.0.0.1").pathname;
      const response = await blueprintRequest(request.method, path, body);
      send(response.status, response.body);
    } catch {
      if (!reply.headersSent) send(500, { error: "The Blueprint endpoint failed." });
    }
  });
  server.listen(port, "127.0.0.1", () => {
    console.log("Blueprint endpoints listening at http://127.0.0.1:" + server.address().port);
  });
}
`;
