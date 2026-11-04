import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(root, "public");
const port = Number(process.env.PORT || 4173);
const employeeId = process.env.EMPLOYEE_ID || "employee";
const employeePassword = process.env.EMPLOYEE_PASSWORD || "factory1984";
const sessionLifetime = 8 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();

if (process.env.NODE_ENV === "production" && (!process.env.EMPLOYEE_ID || !process.env.EMPLOYEE_PASSWORD)) {
  throw new Error("Set EMPLOYEE_ID and EMPLOYEE_PASSWORD before running in production.");
}

const employeeBriefing = {
  employee: "PLAYTIME PERSONNEL",
  clearance: "LEVEL 03 / INTERNAL",
  bulletin: {
    label: "SHIFT BULLETIN / 06:12 AM",
    title: "The attendance sheet is wrong again.",
    text: "There are 37 names on the floor roster. Payroll has 36. Building access logged 38. Please do not correct the paper copy until Facilities signs off.",
  },
  files: [
    {
      code: "FACILITIES / 08-B",
      title: "The lights on the lower floor",
      status: "ACTION REQUIRED",
      summary: "After-hours power readings continue in a sealed wing.",
      detail: "The west corridor drew power for eleven minutes at 2:14 AM. No work order was filed. Facilities requests that staff use the north stairwell until the circuit is inspected.",
    },
    {
      code: "ARCHIVE / 12-C",
      title: "A package with no return address",
      status: "UNCLAIMED",
      summary: "A toy-box-sized parcel was found beside the old mailroom.",
      detail: "The label is addressed to an employee whose access badge was retired years ago. The parcel has not been opened. Contact Records before moving it.",
    },
    {
      code: "SAFETY / 19-A",
      title: "Closing procedure reminder",
      status: "READ BEFORE SHIFT",
      summary: "The factory is not considered empty until the second count is complete.",
      detail: "Confirm the floor roster with your supervisor. Listen for a response before locking the south doors. If the count differs, remain in the lit area and call Facilities.",
    },
  ],
};

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, data, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify(data));
}

function requestIsSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;

  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header.split(";").map((part) => {
      const separator = part.indexOf("=");
      if (separator < 0) return ["", ""];
      return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }),
  );
}

function getSession(request) {
  const token = parseCookies(request.headers.cookie).playtime_session;
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function sessionCookie(request, token, maxAge) {
  const secure = request.socket.encrypted || request.headers["x-forwarded-proto"] === "https";
  return `playtime_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 4096) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function credentialsMatch(input, expected) {
  const provided = Buffer.from(typeof input === "string" ? input : "");
  const wanted = Buffer.from(expected);
  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}

function loginIsBlocked(address) {
  const attempt = loginAttempts.get(address);
  if (!attempt || attempt.resetAt <= Date.now()) {
    loginAttempts.delete(address);
    return false;
  }
  return attempt.count >= 5;
}

function recordFailedLogin(address) {
  const now = Date.now();
  const attempt = loginAttempts.get(address);
  if (!attempt || attempt.resetAt <= now) {
    loginAttempts.set(address, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return;
  }
  attempt.count += 1;
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
}

async function serveStatic(request, response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(publicRoot, relativePath);
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Content-Length": fileInfo.size,
      "Cache-Control": path.extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600",
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
}

const server = createServer(async (request, response) => {
  setSecurityHeaders(response);
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") {
      response.writeHead(204, { Allow: "GET, POST, OPTIONS" }).end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/session") {
      const session = getSession(request);
      sendJson(response, 200, { authenticated: Boolean(session), employeeId: session?.employeeId || null });
      return;
    }

    if (request.method === "POST" && !requestIsSameOrigin(request)) {
      sendJson(response, 403, { error: "This request could not be verified." });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/login") {
      const address = request.socket.remoteAddress || "unknown";
      if (loginIsBlocked(address)) {
        sendJson(response, 429, { error: "Too many attempts. Please wait 15 minutes before trying again." });
        return;
      }

      let body;
      try {
        body = await readJson(request);
      } catch {
        sendJson(response, 400, { error: "Enter an employee ID and password." });
        return;
      }

      if (!credentialsMatch(body.employeeId, employeeId) || !credentialsMatch(body.password, employeePassword)) {
        recordFailedLogin(address);
        sendJson(response, 401, { error: "Access denied. Check your employee ID and password." });
        return;
      }

      loginAttempts.delete(address);
      const token = randomBytes(32).toString("base64url");
      sessions.set(token, { employeeId, expiresAt: Date.now() + sessionLifetime });
      sendJson(response, 200, { authenticated: true }, {
        "Set-Cookie": sessionCookie(request, token, sessionLifetime / 1000),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/employee/briefing") {
      if (!getSession(request)) {
        sendJson(response, 401, { error: "Employee access required." });
        return;
      }
      sendJson(response, 200, employeeBriefing);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/logout") {
      const session = getSession(request);
      if (session) sessions.delete(session.token);
      sendJson(response, 200, { authenticated: false }, {
        "Set-Cookie": sessionCookie(request, "", 0),
      });
      return;
    }

    sendJson(response, 404, { error: "Not found." });
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }
  await serveStatic(request, response, url.pathname);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Playtime Co. is ready at http://localhost:${port}`);
  if (process.env.NODE_ENV !== "production" && !process.env.EMPLOYEE_PASSWORD) {
    console.log("Local demo access: employee / factory1984");
  }
});