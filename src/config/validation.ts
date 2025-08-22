/**
 * Configuration Validation
 * 
 * Validates that all required environment variables are properly configured.
 */

export function validateConfiguration(): boolean {
  const required = ['VITE_API_HOST', 'VITE_API_PORT'];
  const missing = required.filter(key => !import.meta.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    return false;
  }
  
  // Validate port is a number
  const port = import.meta.env.VITE_API_PORT;
  if (port && isNaN(Number(port))) {
    console.error('VITE_API_PORT must be a valid number');
    return false;
  }
  
  // Validate timeout is a number if provided
  const timeout = import.meta.env.VITE_CONNECTION_TIMEOUT;
  if (timeout && isNaN(Number(timeout))) {
    console.error('VITE_CONNECTION_TIMEOUT must be a valid number');
    return false;
  }
  
  // Validate max characters is a number if provided
  const maxChars = import.meta.env.VITE_MAX_CHARACTERS;
  if (maxChars && isNaN(Number(maxChars))) {
    console.error('VITE_MAX_CHARACTERS must be a valid number');
    return false;
  }
  
  return true;
}