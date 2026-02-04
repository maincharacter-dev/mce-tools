/**
 * Startup initialization
 * Runs database checks and migrations on server start
 */

import { initializeDatabase } from "../db-init";
import { resumeIncompleteProcessing, startSandboxPolling } from "../processing-resume";

export async function runStartupTasks() {
  console.log("[Startup] Running initialization tasks...");
  
  try {
    // Initialize main database schema
    const dbInitialized = await initializeDatabase();
    
    if (!dbInitialized) {
      console.warn("[Startup] Database initialization failed - some features may not work");
    }
    
    // Resume incomplete document processing
    // Run in background so it doesn't block server startup
    setTimeout(async () => {
      try {
        await resumeIncompleteProcessing();
        
        // Start polling for large files waiting for sandbox processing
        // This runs every 30 seconds while the sandbox is active
        startSandboxPolling();
      } catch (error) {
        console.error("[Startup] Resume processing error:", error);
      }
    }, 2000); // Wait 2 seconds after startup to let the server stabilize
    
    console.log("[Startup] ✓ Initialization complete");
  } catch (error) {
    console.error("[Startup] Initialization error:", error);
    // Don't crash the server - let it start even if DB init fails
  }
}
