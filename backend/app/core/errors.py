"""Typed domain errors. Services raise these; API exception handlers translate to HTTP."""
from __future__ import annotations


class AppError(Exception):
    """Base for all domain errors."""
    code: str = "internal_error"
    status_code: int = 500

    def __init__(self, message: str = "An unexpected error occurred", *, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(AppError):
    code = "not_found"
    status_code = 404

    def __init__(self, entity: str = "resource", identifier: str | None = None):
        msg = f"{entity} not found" if not identifier else f"{entity} '{identifier}' not found"
        super().__init__(msg)


class PermissionDeniedError(AppError):
    code = "forbidden"
    status_code = 403

    def __init__(self, message: str = "You do not have permission to perform this action"):
        super().__init__(message)


class ValidationError(AppError):
    code = "validation_error"
    status_code = 422

    def __init__(self, message: str = "Validation failed", *, details: dict | None = None):
        super().__init__(message, details=details)


class DuplicateError(AppError):
    code = "duplicate"
    status_code = 409

    def __init__(self, message: str = "Resource already exists"):
        super().__init__(message)


class ConflictError(AppError):
    code = "conflict"
    status_code = 409

    def __init__(self, message: str = "The request conflicts with the current state"):
        super().__init__(message)


class AuthenticationError(AppError):
    code = "authentication_failed"
    status_code = 401

    def __init__(self, message: str = "Invalid credentials"):
        super().__init__(message)


class RateLimitError(AppError):
    code = "rate_limited"
    status_code = 429

    def __init__(self, message: str = "Too many requests, please try again later"):
        super().__init__(message)


class MCPUnavailableError(AppError):
    code = "mcp_unavailable"
    status_code = 503

    def __init__(self, message: str = "Business service temporarily unavailable"):
        super().__init__(message)


class ModelUnavailableError(AppError):
    code = "model_unavailable"
    status_code = 503

    def __init__(self, message: str = "AI model temporarily unavailable"):
        super().__init__(message)
