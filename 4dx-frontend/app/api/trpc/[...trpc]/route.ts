/**
 * tRPC Proxy Route
 * Forwards tRPC requests to the backend server.
 * The backend URL is configurable with environment variables.
 */
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXTAUTH_BACKEND_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000";

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function buildResponse(response: Response) {
  const newResponse = new Response(response.body, response);
  const setCookieHeaders =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  setCookieHeaders.forEach((cookie) => {
    newResponse.headers.append("Set-Cookie", cookie);
  });

  return newResponse;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

  try {
    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
    });

    return buildResponse(response);
  } catch (error) {
    console.error("tRPC backend proxy failed:", error);
    return jsonError(
      502,
      `Unable to reach tRPC backend at ${BACKEND_URL}. Ensure the backend server is running.`
    );
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

  const body = await request.text();
  const contentType = request.headers.get("content-type") || "application/json";

  try {
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        cookie: request.headers.get("cookie") || "",
      },
      body,
    });

    return buildResponse(response);
  } catch (error) {
    console.error("tRPC backend proxy failed:", error);
    return jsonError(
      502,
      `Unable to reach tRPC backend at ${BACKEND_URL}. Ensure the backend server is running.`
    );
  }
}
