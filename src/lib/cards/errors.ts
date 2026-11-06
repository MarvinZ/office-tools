import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Thrown anywhere inside a cards API handler; turned into `{ error: { code, message } }`. */
export class ApiError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Postgres unique_violation — drizzle wraps driver errors, so check the cause too. */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/**
 * Wraps a route handler so every failure comes back as JSON — never an HTML error page,
 * which a mobile client can't parse.
 */
export function withCardsApi<P>(
  handler: (req: Request, ctx: { params: Promise<P> }) => Promise<Response>,
) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err.status, err.code, err.message);
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        const path = issue?.path.join(".");
        return errorResponse(400, "invalid_request", path ? `${path}: ${issue.message}` : (issue?.message ?? "Invalid request."));
      }
      if (err instanceof SyntaxError) return errorResponse(400, "invalid_json", "Request body is not valid JSON.");
      console.error("[cards api]", err);
      return errorResponse(500, "internal_error", "Something went wrong.");
    }
  };
}
