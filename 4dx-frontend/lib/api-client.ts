/**
 * API Client Wrapper
 * Clean interface to tRPC with error handling and utility functions
 */

import { trpc } from "./trpc";
import type { APIError, TRPCErrorData } from "./types";

/**
 * Parse tRPC errors into consistent APIError format
 */
export function parseTRPCError(error: any): APIError {
  const code = error?.data?.code || "INTERNAL_SERVER_ERROR";
  const httpStatus = error?.data?.httpStatus || 500;
  const message = error?.message || "An unexpected error occurred";

  return {
    message,
    code,
    httpStatus,
  };
}

/**
 * Check if error is authorization-related (401/403)
 */
export function isAuthError(error: APIError): boolean {
  return error.code === "UNAUTHORIZED" || error.code === "FORBIDDEN";
}

/**
 * Check if error is a validation error (400)
 */
export function isValidationError(error: APIError): boolean {
  return error.code === "BAD_REQUEST";
}

/**
 * Check if error is a not-found error (404)
 */
export function isNotFoundError(error: APIError): boolean {
  return error.code === "NOT_FOUND";
}

/**
 * Check if error is a conflict error (409)
 */
export function isConflictError(error: APIError): boolean {
  return error.code === "CONFLICT";
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: APIError): string {
  switch (error.code) {
    case "UNAUTHORIZED":
      return "You are not logged in. Please log in and try again.";
    case "FORBIDDEN":
      return "You do not have permission to perform this action.";
    case "NOT_FOUND":
      return "The requested resource was not found.";
    case "CONFLICT":
      return "This resource already exists. Please choose a different name.";
    case "BAD_REQUEST":
      return error.message || "The request was invalid. Please check your input.";
    case "INTERNAL_SERVER_ERROR":
      return "An unexpected server error occurred. Please try again.";
    default:
      return error.message || "An unexpected error occurred.";
  }
}

/**
 * Export tRPC client for use in hooks
 */
export { trpc } from "./trpc";
