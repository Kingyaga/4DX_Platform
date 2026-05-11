const BACKEND_URL = process.env.NEXTAUTH_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

  const response = await fetch(backendUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      cookie: request.headers.get("cookie") || "",
    },
  });

  const newResponse = new Response(response.body, response);
  const setCookieHeaders = response.headers.getSetCookie();
  setCookieHeaders.forEach((cookie) => {
    newResponse.headers.append("Set-Cookie", cookie);
  });

  return newResponse;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

  const body = await request.text();
  const contentType = request.headers.get("content-type") || "application/json";

  const response = await fetch(backendUrl, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      cookie: request.headers.get("cookie") || "",
    },
    body,
  });

  const newResponse = new Response(response.body, response);
  const setCookieHeaders = response.headers.getSetCookie();
  setCookieHeaders.forEach((cookie) => {
    newResponse.headers.append("Set-Cookie", cookie);
  });

  return newResponse;
}
