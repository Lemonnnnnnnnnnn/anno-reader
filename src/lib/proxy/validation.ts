/**
 * Input validation for proxy configuration.
 *
 * Validates address and port when proxy is enabled.
 * Returns structured error messages for UI display.
 */

import type { ProxyConfig } from "../storage/config";

/** Validation error for a specific field. */
export interface ProxyValidationError {
  field: "address" | "port";
  message: string;
}

/**
 * Validate proxy configuration.
 *
 * Rules (only enforced when `enabled` is true):
 * - Address: required, trimmed of whitespace
 * - Port: required, must be a numeric value, must be 1–65535
 *
 * @returns Array of validation errors (empty if valid)
 */
export function validateProxyConfig(config: ProxyConfig): ProxyValidationError[] {
  const errors: ProxyValidationError[] = [];

  if (!config.enabled) {
    return errors;
  }

  const trimmedAddress = config.address.trim();
  if (!trimmedAddress) {
    errors.push({ field: "address", message: "Proxy address is required." });
  }

  const trimmedPort = config.port.trim();
  if (!trimmedPort) {
    errors.push({ field: "port", message: "Proxy port is required." });
  } else {
    const portNum = Number(trimmedPort);
    if (!Number.isInteger(portNum) || String(portNum) !== trimmedPort) {
      errors.push({ field: "port", message: "Port must be a valid number." });
    } else if (portNum < 1 || portNum > 65535) {
      errors.push({ field: "port", message: "Port must be between 1 and 65535." });
    }
  }

  return errors;
}

/**
 * Check whether proxy configuration is valid.
 *
 * @returns `true` if no validation errors exist
 */
export function isProxyConfigValid(config: ProxyConfig): boolean {
  return validateProxyConfig(config).length === 0;
}
