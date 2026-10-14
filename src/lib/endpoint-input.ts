import type { Endpoint } from "@/lib/types";

export type EndpointFields = Pick<
  Endpoint,
  | "name"
  | "url"
  | "method"
  | "headers"
  | "body"
  | "expected_status"
  | "check_interval_seconds"
  | "timeout_ms"
  | "retries"
  | "is_active"
>;

const fieldNames = new Set<string>([
  "name",
  "url",
  "method",
  "headers",
  "body",
  "expected_status",
  "check_interval_seconds",
  "timeout_ms",
  "retries",
  "is_active",
]);

const methods = new Set(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]);

type ValidationResult =
  | { ok: true; value: Partial<EndpointFields> }
  | { ok: false; error: string };

export function validateEndpointFields(
  input: unknown,
  partial = false
): ValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const entries = Object.entries(input);
  const values: Partial<EndpointFields> = {};

  if (entries.length === 0) {
    return { ok: false, error: "At least one endpoint field is required" };
  }

  for (const [key, value] of entries) {
    if (!fieldNames.has(key)) {
      return { ok: false, error: `Unsupported endpoint field: ${key}` };
    }

    switch (key) {
      case "name":
        if (typeof value !== "string" || !value.trim()) {
          return { ok: false, error: "Name must be a non-empty string" };
        }
        values.name = value.trim();
        break;
      case "url": {
        if (typeof value !== "string" || !value.trim()) {
          return { ok: false, error: "URL must be a non-empty string" };
        }
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(value);
        } catch {
          return { ok: false, error: "URL must be a valid HTTP or HTTPS URL" };
        }
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          return { ok: false, error: "URL must be a valid HTTP or HTTPS URL" };
        }
        values.url = value.trim();
        break;
      }
      case "method":
        if (typeof value !== "string" || !methods.has(value.toUpperCase())) {
          return { ok: false, error: "Method must be a supported HTTP method" };
        }
        values.method = value.toUpperCase();
        break;
      case "headers":
        if (
          typeof value !== "object" ||
          value === null ||
          Array.isArray(value)
        ) {
          return { ok: false, error: "Headers must be an object with string values" };
        }
        {
          const headers: Record<string, string> = {};
          for (const [headerName, headerValue] of Object.entries(value)) {
            if (typeof headerValue !== "string") {
              return {
                ok: false,
                error: "Headers must be an object with string values",
              };
            }
            headers[headerName] = headerValue;
          }
          values.headers = headers;
        }
        break;
      case "body":
        if (value !== null && typeof value !== "string") {
          return { ok: false, error: "Body must be a string or null" };
        }
        values.body = value;
        break;
      case "expected_status":
        if (
          typeof value !== "number" ||
          !Number.isInteger(value) ||
          value < 100 ||
          value > 599
        ) {
          return { ok: false, error: "Expected status must be an HTTP status code" };
        }
        values.expected_status = value;
        break;
      case "check_interval_seconds":
        if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
          return { ok: false, error: "Check interval must be a positive integer" };
        }
        values.check_interval_seconds = value;
        break;
      case "timeout_ms":
        if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
          return { ok: false, error: "Timeout must be a positive integer" };
        }
        values.timeout_ms = value;
        break;
      case "retries":
        if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
          return { ok: false, error: "Retries must be a non-negative integer" };
        }
        values.retries = value;
        break;
      case "is_active":
        if (typeof value !== "boolean") {
          return { ok: false, error: "Active status must be a boolean" };
        }
        values.is_active = value;
        break;
    }
  }

  if (!partial && (!values.name || !values.url)) {
    return { ok: false, error: "Name and URL are required" };
  }

  return { ok: true, value: values };
}
