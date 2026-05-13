const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXTAUTH_BACKEND_URL ||
  "http://localhost:3000";

function buildResponse(response: Response) {
  const headers = new Headers(response.headers);
  const setCookieHeaders =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  setCookieHeaders.forEach((cookie) => {
    headers.append("Set-Cookie", cookie);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function proxyRequest(request: Request) {
  const url = new URL(request.url);
  const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;
  console.log("Proxying request to:", backendUrl, "method:", request.method);

  const init: RequestInit = {
    method: request.method,
    redirect: "manual",
    headers: {
      cookie: request.headers.get("cookie") || "",
      accept: request.headers.get("accept") || "*/*",
    },
  };

  if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
    const contentType = request.headers.get("content-type");
    if (
      contentType?.includes("application/json") ||
      contentType?.includes("application/x-www-form-urlencoded")
    ) {
      init.body = await request.text();
      init.headers = {
        ...init.headers,
        "Content-Type": contentType || "application/json",
      };
    } else {
      init.body = await request.arrayBuffer();
      if (contentType) {
        (init.headers as Record<string, string>)["Content-Type"] = contentType;
      }
    }
  }

  try {
    const response = await fetch(backendUrl, init);
    return buildResponse(response);
  } catch (error) {
    console.error("Auth backend proxy failed:", error);
    return jsonError(
      502,
      `Unable to reach auth backend at ${BACKEND_URL}. Ensure the backend server is running and reachable.`
    );
  }
}

export async function GET(request: Request) {
  return proxyRequest(request);
}

export async function POST(request: Request) {
  return proxyRequest(request);
}

export async function HEAD(request: Request) {
  const getRequest = new Request(request, { method: "GET" });
  return proxyRequest(getRequest);
}

export async function OPTIONS(request: Request) {
  return proxyRequest(request);
}
