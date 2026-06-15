// Environment variable configuration and validation
// REQ-API-016 ~ REQ-API-019
import Constants from 'expo-constants';

/**
 * Runtime environment variable access with validation
 * Throws error if required variables are missing (fail-fast)
 * REQ-API-018: Fail-fast when environment variables are missing
 */
export function getEnvVar(key: string): string {
  const value = Constants.expoConfig?.extra?.[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
}

/**
 * Get optional environment variable with default value
 * REQ-API-018: Graceful fallback for optional variables
 */
export function getOptionalEnvVar(key: string, defaultValue: string): string {
  return Constants.expoConfig?.extra?.[key] || defaultValue;
}
