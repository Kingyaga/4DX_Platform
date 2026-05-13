/**
 * Error Boundary & State Components
 */

"use client";

import type { APIError } from "../types";
import { getErrorMessage } from "../api-client";

interface ErrorStateProps {
  error: APIError | null;
  title?: string;
  onRetry?: () => void;
}

export function ErrorState({
  error,
  title = "Something went wrong",
  onRetry,
}: ErrorStateProps) {
  if (!error) return null;

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <h3 className="font-semibold text-red-900 mb-2">{title}</h3>
      <p className="text-red-800 text-sm mb-4">{getErrorMessage(error)}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="py-12 text-center">
      {icon && <div className="mb-4 flex justify-center text-4xl">{icon}</div>}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-600 text-sm mb-6">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface LoadingStateProps {
  title?: string;
  description?: string;
}

export function LoadingState({
  title = "Loading",
  description = "Please wait...",
}: LoadingStateProps) {
  return (
    <div className="py-12 text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent mb-4"></div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}

interface PermissionDeniedProps {
  resource?: string;
  requiredRole?: string;
}

export function PermissionDenied({
  resource = "this resource",
  requiredRole = "admin",
}: PermissionDeniedProps) {
  return (
    <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
      <h3 className="text-lg font-semibold text-yellow-900 mb-2">
        Access Denied
      </h3>
      <p className="text-yellow-800 text-sm">
        You don't have permission to access {resource}. This action requires{" "}
        <strong>{requiredRole}</strong> privileges.
      </p>
    </div>
  );
}

interface NotFoundProps {
  resource?: string;
}

export function NotFound({ resource = "Resource" }: NotFoundProps) {
  return (
    <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Not Found</h3>
      <p className="text-gray-600 text-sm">
        {resource} was not found or has been deleted.
      </p>
    </div>
  );
}
