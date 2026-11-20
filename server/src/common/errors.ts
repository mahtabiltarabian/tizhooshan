import { HttpException } from "@nestjs/common";

/** An error the client sees as `{ error: code }` with `status`. */
export class ApiError extends HttpException {
  constructor(
    status: number,
    public readonly code: string,
  ) {
    super({ error: code }, status);
  }
}

export const badRequest = (code = "bad_request") => new ApiError(400, code);
export const notFound = () => new ApiError(404, "not_found");
export const forbidden = () => new ApiError(403, "forbidden");
