export async function GET(request: Request) {
  const url = new URL(request.url);
  const newUrl = `http://localhost:3000${url.pathname}${url.search}`;
  const response = await fetch(newUrl, {
    headers: request.headers,
    method: "GET",
  });
  return response;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const newUrl = `http://localhost:3000${url.pathname}${url.search}`;
  const response = await fetch(newUrl, {
    headers: request.headers,
    method: "POST",
    body: request.body,
    duplex: "half",
  } as RequestInit);
  return response;
}