# AI Agent Module - Dynamic Integration Guide

**Version:** 1.0  
**Date:** February 10, 2026  
**Source Repository:** [robachamilton-afk/mce-tools](https://github.com/robachamilton-afk/mce-tools)

---

## Overview

This guide explains how to **dynamically integrate** the AI Agent module into any existing application. The agent is designed as a reusable module that can be pulled from the source repository, ensuring that updates and modifications automatically propagate to all deployments.

## Architecture Approach

The agent module uses a **Git submodule** or **npm package** approach for dynamic integration:

1. **Source of Truth**: The `mce-tools` repository contains the canonical agent implementation
2. **Dynamic Integration**: Target applications reference the agent as a submodule or package
3. **Automatic Updates**: Pull latest changes from the source repository to get updates
4. **Zero Duplication**: Single codebase, multiple deployments

---

## Integration Methods

### Method 1: Git Submodule (Recommended for Monorepos)

This approach keeps the agent code in sync across multiple applications while allowing centralized updates.

#### Step 1: Add Agent as Submodule

In your target application repository:

```bash
# Navigate to your application root
cd /path/to/your-application

# Add the agent module as a submodule
git submodule add https://github.com/robachamilton-afk/mce-tools.git external/mce-tools

# Initialize and update the submodule
git submodule init
git submodule update

# Create symlinks to agent module in your project structure
ln -s ../../external/mce-tools/server/agent server/agent
ln -s ../../external/mce-tools/client/components/AgentChat.tsx client/components/AgentChat.tsx
```

#### Step 2: Configure TypeScript Paths

Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@agent/*": ["./external/mce-tools/server/agent/*"],
      "@agent-ui/*": ["./external/mce-tools/client/components/*"]
    }
  }
}
```

#### Step 3: Import and Register Agent

In your main router file (e.g., `server/routers.ts`):

```typescript
import { router } from "./trpc";
import { agentRouter } from "@agent/agent-router";

export const appRouter = router({
  // Your existing routers
  auth: authRouter,
  projects: projectsRouter,
  
  // Add agent router
  agent: agentRouter,
});
```

#### Step 4: Update Agent Module

To pull latest changes from the source repository:

```bash
# Update the submodule to latest version
cd external/mce-tools
git pull origin master

# Or update all submodules
cd /path/to/your-application
git submodule update --remote --merge

# Commit the submodule update
git add external/mce-tools
git commit -m "chore: Update agent module to latest version"
```

---

### Method 2: NPM Package (Recommended for Distributed Deployments)

This approach packages the agent as an npm module for easy distribution and versioning.

#### Step 1: Create Package from Agent Module

In the `mce-tools` repository, create `server/agent/package.json`:

```json
{
  "name": "@oe-ecosystem/ai-agent",
  "version": "1.0.0",
  "description": "AI Agent module for OE Ecosystem applications",
  "main": "agent-orchestrator.js",
  "types": "agent-orchestrator.d.ts",
  "exports": {
    ".": "./agent-orchestrator.js",
    "./router": "./agent-router.js",
    "./tools/*": "./tools/*.js",
    "./ui": "../../../client/components/AgentChat.js"
  },
  "peerDependencies": {
    "drizzle-orm": "^0.30.0",
    "mysql2": "^3.0.0",
    "zod": "^3.22.0",
    "@trpc/server": "^10.0.0",
    "react": "^19.0.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/robachamilton-afk/mce-tools.git",
    "directory": "server/agent"
  },
  "keywords": ["ai", "agent", "llm", "renewable-energy", "due-diligence"],
  "author": "OE Ecosystem",
  "license": "MIT"
}
```

#### Step 2: Publish to Private NPM Registry (or use Git URL)

```bash
# Option A: Publish to private npm registry
cd server/agent
npm publish --access restricted

# Option B: Use Git URL directly (no publishing needed)
# In target application:
npm install git+https://github.com/robachamilton-afk/mce-tools.git#master:server/agent
```

#### Step 3: Install in Target Application

```bash
cd /path/to/your-application

# If published to npm
npm install @oe-ecosystem/ai-agent

# If using git URL
npm install git+https://github.com/robachamilton-afk/mce-tools.git
```

#### Step 4: Import and Use

```typescript
import { AgentOrchestrator } from "@oe-ecosystem/ai-agent";
import { agentRouter } from "@oe-ecosystem/ai-agent/router";
import { AgentChat } from "@oe-ecosystem/ai-agent/ui";

// Register router
export const appRouter = router({
  agent: agentRouter,
});

// Use orchestrator
const agent = new AgentOrchestrator(db, getProjectDb);

// Use UI component
<AgentChat projectId={123} />
```

#### Step 5: Update Agent Module

```bash
# Update to latest version
npm update @oe-ecosystem/ai-agent

# Or if using git URL
npm install git+https://github.com/robachamilton-afk/mce-tools.git --force
```

---

### Method 3: Direct File Sync (Simple but Manual)

For simpler setups, use a sync script to copy files from the source repository.

#### Step 1: Create Sync Script

Create `scripts/sync-agent.sh` in your target application:

```bash
#!/bin/bash

# Configuration
SOURCE_REPO="https://github.com/robachamilton-afk/mce-tools.git"
TEMP_DIR="/tmp/mce-tools-sync"
TARGET_DIR="$(pwd)"

# Clone or update source repository
if [ -d "$TEMP_DIR" ]; then
  echo "Updating source repository..."
  cd "$TEMP_DIR"
  git pull origin master
else
  echo "Cloning source repository..."
  git clone "$SOURCE_REPO" "$TEMP_DIR"
fi

# Sync agent module files
echo "Syncing agent module..."
rsync -av --delete \
  "$TEMP_DIR/server/agent/" \
  "$TARGET_DIR/server/agent/"

# Sync UI component
echo "Syncing UI component..."
rsync -av \
  "$TEMP_DIR/client/components/AgentChat.tsx" \
  "$TARGET_DIR/client/components/"

# Sync database migration
echo "Syncing database migration..."
mkdir -p "$TARGET_DIR/migrations/agent"
rsync -av \
  "$TEMP_DIR/server/agent/migrations/" \
  "$TARGET_DIR/migrations/agent/"

echo "Agent module synced successfully!"
echo "Don't forget to run database migrations if schema changed."
```

#### Step 2: Run Sync Script

```bash
chmod +x scripts/sync-agent.sh
./scripts/sync-agent.sh
```

#### Step 3: Automate with Git Hooks

Add to `.git/hooks/post-merge`:

```bash
#!/bin/bash
echo "Syncing agent module after merge..."
./scripts/sync-agent.sh
```

---

## Database Integration

The agent requires 7 database tables. Choose your integration approach:

### Option A: Shared Schema (Recommended)

Add agent tables to your main database schema file:

```typescript
// In your schema.ts
export * from "@agent/schema"; // If using npm package

// Or manually copy from external/mce-tools/server/agent/schema.ts
```

### Option B: Separate Migration

Keep agent migrations separate:

```bash
# Run agent migration
mysql -u user -p database < external/mce-tools/server/agent/migrations/001_create_agent_tables.sql

# Or if using npm package
mysql -u user -p database < node_modules/@oe-ecosystem/ai-agent/migrations/001_create_agent_tables.sql
```

### Option C: Drizzle Kit Integration

If using Drizzle Kit:

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./server/schema.ts",
    "./external/mce-tools/server/agent/schema.ts", // Add agent schema
  ],
  out: "./migrations",
  driver: "mysql2",
});
```

Then run:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

---

## Configuration Requirements

### 1. Environment Variables

Ensure these are set in your target application:

```bash
# LLM API (choose one)
OPENAI_API_KEY=sk-your-openai-key
# OR
FORGE_API_KEY=your-forge-key
FORGE_API_URL=https://forge.manus.im

# Database (should already be configured)
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=your_database
```

### 2. Dependencies

Add to your `package.json` if not already present:

```json
{
  "dependencies": {
    "@trpc/server": "^10.45.0",
    "drizzle-orm": "^0.30.0",
    "mysql2": "^3.9.0",
    "zod": "^3.22.4",
    "react": "^19.0.0",
    "lucide-react": "^0.344.0"
  }
}
```

### 3. TypeScript Configuration

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

---

## Router Integration

### Full Integration Example

```typescript
// server/routers.ts
import { router, protectedProcedure } from "./trpc";
import { agentRouter } from "./agent/agent-router"; // From submodule/package

export const appRouter = router({
  // Your existing routers
  auth: router({
    me: protectedProcedure.query(opts => opts.ctx.user),
  }),
  
  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // Your project logic
    }),
  }),
  
  // Add agent router
  agent: agentRouter,
});

export type AppRouter = typeof appRouter;
```

### Custom Context Integration

If your application has custom context requirements:

```typescript
// server/agent/agent-router.ts (modify if needed)
import { router, protectedProcedure } from "../_core/trpc";

// The agent router uses your existing protectedProcedure
// which should provide ctx.user and ctx.db

export const agentRouter = router({
  chat: protectedProcedure
    .input(/* ... */)
    .mutation(async ({ input, ctx }) => {
      // ctx.user is provided by your auth middleware
      // ctx.db is provided by your database middleware
      
      const agent = await getOrchestrator();
      return await agent.processMessage({
        userId: ctx.user.id, // Uses your user object
        projectId: input.projectId,
        message: input.message,
      });
    }),
});
```

---

## UI Integration

### React Component Integration

```typescript
// In your project page component
import { AgentChat } from "@/components/AgentChat";
// Or from package: import { AgentChat } from "@oe-ecosystem/ai-agent/ui";

export function ProjectDashboard({ projectId }: { projectId: number }) {
  return (
    <div className="container mx-auto p-4">
      <h1>Project Dashboard</h1>
      
      {/* Your existing UI */}
      <div className="grid grid-cols-2 gap-4">
        <ProjectStats projectId={projectId} />
        <DocumentList projectId={projectId} />
      </div>
      
      {/* Add Agent Chat */}
      <div className="mt-8">
        <AgentChat
          projectId={projectId}
          onConversationCreated={(id) => {
            console.log("Conversation started:", id);
          }}
        />
      </div>
    </div>
  );
}
```

### Custom Styling

The agent UI uses Tailwind CSS. To customize:

```typescript
// Create a wrapper component
import { AgentChat as BaseAgentChat } from "@/components/AgentChat";

export function CustomAgentChat(props) {
  return (
    <div className="my-custom-container">
      <BaseAgentChat {...props} />
    </div>
  );
}
```

Or modify the component directly in your local copy.

---

## Customization and Extension

### Adding Custom Tools

Create new tools in your application:

```typescript
// server/custom-agent-tools.ts
import type { ToolDefinition } from "./agent/tool-executor";

export const myCustomTool: ToolDefinition = {
  name: "my_custom_tool",
  description: "Does something specific to my application",
  parameters: {
    type: "object",
    properties: {
      param1: { type: "string", description: "Parameter 1" },
    },
    required: ["param1"],
  },
  handler: async (args, context) => {
    // Your custom logic
    return { result: "Custom result" };
  },
};
```

Register in your router:

```typescript
// server/routers.ts
import { AgentOrchestrator } from "./agent/agent-orchestrator";
import { myCustomTool } from "./custom-agent-tools";

// Extend the orchestrator
const orchestrator = new AgentOrchestrator(db, getProjectDb);
orchestrator.toolExecutor.registerTool(myCustomTool);
```

### Customizing System Prompts

Override the system prompt builder:

```typescript
// server/custom-agent-orchestrator.ts
import { AgentOrchestrator } from "./agent/agent-orchestrator";

export class CustomAgentOrchestrator extends AgentOrchestrator {
  protected buildSystemPrompt(request: AgentRequest): string {
    let prompt = super.buildSystemPrompt(request);
    
    // Add your custom context
    prompt += `\n\nAdditional context for my application:
    - Custom feature X is enabled
    - User has access to Y
    - Current workflow: ${request.context?.workflowStage}`;
    
    return prompt;
  }
}
```

### Customizing Learning Behavior

Override learning engine methods:

```typescript
// server/custom-learning-engine.ts
import { LearningEngine } from "./agent/learning-engine";

export class CustomLearningEngine extends LearningEngine {
  async extractPatterns(draftContent: string, finalContent: string) {
    const basePatterns = await super.extractPatterns(draftContent, finalContent);
    
    // Add custom pattern extraction
    const customPatterns = {
      ...basePatterns,
      myCustomMetric: this.calculateCustomMetric(draftContent, finalContent),
    };
    
    return customPatterns;
  }
  
  private calculateCustomMetric(draft: string, final: string): number {
    // Your custom logic
    return 0.85;
  }
}
```

---

## Update Workflow

### Pulling Updates from Source Repository

#### Using Git Submodule

```bash
# Update to latest version
cd external/mce-tools
git pull origin master
cd ../..

# Test the changes
pnpm build
pnpm test

# Commit the update
git add external/mce-tools
git commit -m "chore: Update agent module to latest version"
git push
```

#### Using NPM Package

```bash
# Update to latest version
npm update @oe-ecosystem/ai-agent

# Or force reinstall
npm install @oe-ecosystem/ai-agent@latest --force

# Test the changes
pnpm build
pnpm test

# Commit the update
git add package.json package-lock.json
git commit -m "chore: Update agent module to latest version"
git push
```

#### Using Sync Script

```bash
# Run sync script
./scripts/sync-agent.sh

# Review changes
git diff server/agent/

# Commit if satisfied
git add server/agent/
git commit -m "chore: Sync agent module from source repository"
git push
```

### Handling Breaking Changes

If the agent module introduces breaking changes:

1. **Check Migration Notes**: Review `CHANGELOG.md` in the source repository
2. **Run Database Migrations**: Apply any new schema changes
3. **Update API Calls**: Adjust any changed API signatures
4. **Test Thoroughly**: Run integration tests before deploying

Example migration workflow:

```bash
# Pull latest changes
git submodule update --remote

# Check for new migrations
ls external/mce-tools/server/agent/migrations/

# Run new migrations
mysql -u user -p database < external/mce-tools/server/agent/migrations/002_new_migration.sql

# Update code if API changed
# ... make necessary adjustments ...

# Test
pnpm test

# Deploy
git add .
git commit -m "chore: Update agent module with breaking changes"
git push
```

---

## Testing Integration

### Unit Tests

Test that the agent is properly integrated:

```typescript
// tests/agent-integration.test.ts
import { describe, it, expect } from "vitest";
import { appRouter } from "../server/routers";

describe("Agent Integration", () => {
  it("should have agent router registered", () => {
    expect(appRouter._def.procedures.agent).toBeDefined();
  });
  
  it("should be able to create agent orchestrator", async () => {
    const { AgentOrchestrator } = await import("../server/agent/agent-orchestrator");
    expect(AgentOrchestrator).toBeDefined();
  });
  
  it("should have all required tools registered", async () => {
    const { queryTools } = await import("../server/agent/tools/query-tools");
    const { generationTools } = await import("../server/agent/tools/generation-tools");
    const { workflowTools } = await import("../server/agent/tools/workflow-tools");
    
    expect(queryTools.length).toBeGreaterThan(0);
    expect(generationTools.length).toBeGreaterThan(0);
    expect(workflowTools.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

Test end-to-end functionality:

```typescript
// tests/agent-e2e.test.ts
import { describe, it, expect } from "vitest";
import { createTRPCClient } from "@trpc/client";
import type { AppRouter } from "../server/routers";

describe("Agent E2E", () => {
  const client = createTRPCClient<AppRouter>({
    url: "http://localhost:5173/trpc",
  });
  
  it("should send message and receive response", async () => {
    const response = await client.agent.chat.mutate({
      projectId: 1,
      message: "Hello, what can you help me with?",
    });
    
    expect(response.conversationId).toBeDefined();
    expect(response.message).toBeDefined();
    expect(response.metadata.latency).toBeGreaterThan(0);
  });
});
```

---

## Deployment Checklist

Before deploying to production:

- [ ] **Database Migration**: Run agent table creation script
- [ ] **Environment Variables**: Verify API keys are set
- [ ] **Dependencies**: Ensure all peer dependencies are installed
- [ ] **Build**: Run `pnpm build` successfully
- [ ] **Tests**: All integration tests pass
- [ ] **Router Registration**: Agent router is registered in main router
- [ ] **UI Component**: AgentChat component is accessible
- [ ] **Documentation**: Team is aware of new agent features
- [ ] **Monitoring**: Set up logging for agent actions
- [ ] **Backup**: Database backup before migration

---

## Troubleshooting

### Module Not Found

**Error**: `Cannot find module './agent/agent-router'`

**Solution**:
```bash
# If using submodule
git submodule update --init --recursive

# If using npm package
npm install @oe-ecosystem/ai-agent

# If using sync script
./scripts/sync-agent.sh
```

### Database Tables Missing

**Error**: `Table 'agent_conversations' doesn't exist`

**Solution**:
```bash
# Run migration
mysql -u user -p database < server/agent/migrations/001_create_agent_tables.sql

# Or use Drizzle Kit
pnpm drizzle-kit push
```

### API Key Not Found

**Error**: `OpenAI API key not configured`

**Solution**:
```bash
# Set environment variable
export OPENAI_API_KEY=sk-your-key-here

# Or add to .env file
echo "OPENAI_API_KEY=sk-your-key-here" >> .env

# Restart server
pnpm dev
```

### Type Errors After Update

**Error**: Type mismatches after updating agent module

**Solution**:
```bash
# Regenerate types
pnpm build

# Clear TypeScript cache
rm -rf node_modules/.cache

# Restart TypeScript server in your IDE
```

---

## Maintenance

### Regular Updates

Set up a schedule to pull agent updates:

```bash
# Weekly update script
#!/bin/bash
echo "Checking for agent module updates..."

cd external/mce-tools
git fetch origin

# Check if updates are available
if [ $(git rev-list HEAD...origin/master --count) -gt 0 ]; then
  echo "Updates available. Pulling changes..."
  git pull origin master
  
  cd ../..
  pnpm build
  pnpm test
  
  if [ $? -eq 0 ]; then
    echo "Update successful!"
    git add external/mce-tools
    git commit -m "chore: Update agent module (automated)"
    git push
  else
    echo "Update failed. Rolling back..."
    cd external/mce-tools
    git reset --hard HEAD@{1}
  fi
else
  echo "Already up to date."
fi
```

### Monitoring Updates

Subscribe to repository changes:

1. Watch the source repository on GitHub
2. Enable notifications for releases
3. Review changelog before updating
4. Test in staging before production

---

## Support and Contributing

### Getting Help

- **Documentation**: Check [server/agent/README.md](https://github.com/robachamilton-afk/mce-tools/blob/master/server/agent/README.md)
- **Issues**: Report bugs in the source repository
- **Discussions**: Use GitHub Discussions for questions

### Contributing Back

If you make improvements to the agent module:

1. Fork the source repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
5. Changes will be reviewed and merged
6. Update your integration to pull the merged changes

---

## Summary

This integration guide provides three methods for dynamically integrating the AI Agent module:

1. **Git Submodule** - Best for monorepos, direct code access
2. **NPM Package** - Best for distributed deployments, version control
3. **Sync Script** - Best for simple setups, manual control

Choose the method that best fits your architecture and workflow. All methods ensure that updates to the source repository can be pulled into your deployment, maintaining a single source of truth while allowing customization and extension.

---

**Source Repository**: [robachamilton-afk/mce-tools](https://github.com/robachamilton-afk/mce-tools)  
**Agent Module Path**: `server/agent/`  
**Version**: 1.0.0  
**Last Updated**: February 10, 2026
