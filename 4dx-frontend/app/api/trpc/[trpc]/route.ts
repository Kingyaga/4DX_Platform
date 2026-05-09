/**
 * tRPC Proxy Route
 * Forwards tRPC requests to the backend server at localhost:3000
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const backendUrl = `http://localhost:3000${url.pathname}${url.search}`;

  const response = await fetch(backendUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      cookie: request.headers.get("cookie") || "",
    },
  });

  // Create a new response, copying headers including Set-Cookie
  const newResponse = new Response(response.body, response);
  
  // Explicitly forward Set-Cookie headers
  const setCookieHeaders = response.headers.getSetCookie();
  setCookieHeaders.forEach(cookie => {
    newResponse.headers.append("Set-Cookie", cookie);
  });

  return newResponse;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const backendUrl = `http://localhost:3000${url.pathname}${url.search}`;

  // Read the body once
  const body = await request.text();
  
  // Get the content-type from the original request
  const contentType = request.headers.get("content-type") || "application/json";

  const response = await fetch(backendUrl, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      cookie: request.headers.get("cookie") || "",
    },
    body: body,
  });

  // Create a new response, copying headers including Set-Cookie
  const newResponse = new Response(response.body, response);
  
  // Explicitly forward Set-Cookie headers
  const setCookieHeaders = response.headers.getSetCookie();
  setCookieHeaders.forEach(cookie => {
    newResponse.headers.append("Set-Cookie", cookie);
  });

  return newResponse;
}
