/**
 * Main entry point for the Backblaze B2 Node.js Library
 * Provides ES module exports with CommonJS compatibility
 * Optimized for tree-shaking - only import what you need
 */

// Main client class - primary export
export { B2Client } from './b2-client.js';

// Constants for backward compatibility
export { BUCKET_TYPES, KEY_CAPABILITIES } from './constants.js';

// Core classes (for advanced usage - tree-shakeable)
export { HttpClient } from './core/http-client.js';
export { RetryHandler } from './core/retry-handler.js';
export { ErrorHandler, B2Error } from './core/error-handler.js';
export { ProgressHandler } from './core/progress-handler.js';

// Manager classes (for advanced usage - tree-shakeable)
export { AuthManager } from './managers/auth-manager.js';
export { BucketManager } from './managers/bucket-manager.js';
export { FileManager } from './managers/file-manager.js';
export { KeyManager } from './managers/key-manager.js';

// Utility classes (for advanced usage - tree-shakeable)
export { EndpointBuilder } from './utils/endpoints.js';
export { AuthHeaders, HeaderUtils } from './utils/headers.js';
export { Validator } from './utils/validation.js';
export { Sha1Hasher } from './utils/crypto.js';

// Import for default export
import { B2Client } from './b2-client.js';

// Default export for backward compatibility (CommonJS)
export default B2Client;
