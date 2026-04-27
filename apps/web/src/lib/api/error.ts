export class ApiError extends Error {
  public readonly status: number;
  public readonly requestId?: string;
  public readonly details?: unknown;
  public readonly code?: string;

  constructor(
    message: string,
    options: { status: number; requestId?: string; details?: unknown; code?: string }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.requestId = options.requestId;
    this.details = options.details;
    this.code = options.code;
  }
}
