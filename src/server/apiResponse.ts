export function apiSuccess(data: unknown, status = 200) {
  return Response.json(
    {
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: "1",
      },
    },
    { status },
  );
}

export function apiError(code: string, message: string, status: number) {
  return Response.json(
    {
      error: { code, message },
      meta: {
        timestamp: new Date().toISOString(),
        version: "1",
      },
    },
    { status },
  );
}
