# AI Agent Module - Quick Start Guide

Get the AI Agent up and running in 5 minutes.

## Prerequisites

- mce-tools repository cloned
- MySQL/TiDB database running
- Node.js 22+ installed
- OpenAI API key or Manus Forge access

## Step 1: Database Setup (2 minutes)

Run the migration to create agent tables:

```bash
cd /home/ubuntu/mce-tools

# Option A: Using MySQL CLI
mysql -u your_username -p your_database < server/agent/migrations/001_create_agent_tables.sql

# Option B: Using Drizzle Kit (if configured)
pnpm db:push
```

Verify tables were created:

```bash
mysql -u your_username -p -e "SHOW TABLES LIKE 'agent_%';" your_database
```

Expected output:
```
agent_actions
agent_conversations
agent_generated_content
agent_knowledge_base
agent_learning_samples
agent_messages
agent_style_models
```

## Step 2: Environment Configuration (1 minute)

Ensure your `.env` file has LLM API configuration:

```bash
# Check if API key is set
grep -E "OPENAI_API_KEY|FORGE_API_KEY" .env

# If not set, add one:
echo "OPENAI_API_KEY=sk-your-key-here" >> .env
# OR
echo "FORGE_API_KEY=your-forge-key" >> .env
```

## Step 3: Build and Start (2 minutes)

```bash
# Install dependencies (if not already done)
pnpm install

# Build the application
pnpm build

# Start in development mode
pnpm dev

# Or start in production mode
pnpm start
```

The server should start on `http://localhost:5173` (or your configured port).

## Step 4: Test the Agent

### Option A: Using the UI

1. Navigate to `http://localhost:5173` in your browser
2. Log in to your account
3. Open any project
4. Look for the AI Agent chat interface
5. Send a test message: "Hello, what can you help me with?"

### Option B: Using the API

```bash
# Test the agent endpoint (replace YOUR_TOKEN with actual auth token)
curl -X POST http://localhost:5173/trpc/agent.chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "projectId": 1,
    "message": "What are the high-risk facts in this project?"
  }'
```

### Option C: Using tRPC Client

```typescript
import { trpc } from "./lib/trpc";

const response = await trpc.agent.chat.mutate({
  projectId: 1,
  message: "Give me a project summary",
});

console.log(response.message);
console.log(response.toolsUsed);
```

## Example Queries to Try

Once the agent is running, try these example queries:

### Data Queries
- "Show me all high-severity red flags"
- "What documents have been uploaded?"
- "List all technical facts"
- "Give me a project summary"

### Content Generation
- "Generate a risk narrative for fact #123"
- "Create an executive summary of this project"
- "Write a technical specification for the solar system"

### Workflow Assistance
- "What should I do next with this project?"
- "Check the workflow status"
- "What data is missing?"
- "Is this project ready for deliverables?"

## Troubleshooting

### Agent not responding

**Check database connection:**
```bash
mysql -u user -p -e "SELECT COUNT(*) FROM agent_conversations;"
```

**Check API key:**
```bash
echo $OPENAI_API_KEY
# or
echo $FORGE_API_KEY
```

**Check server logs:**
```bash
tail -f logs/server.log | grep -i agent
```

### "Table doesn't exist" error

Run the migration again:
```bash
mysql -u user -p database < server/agent/migrations/001_create_agent_tables.sql
```

### "API key not found" error

Set the environment variable:
```bash
export OPENAI_API_KEY=sk-your-key-here
# Then restart the server
```

### Tools not executing

Check that tools are registered:
```bash
grep "registerTools" server/agent/agent-orchestrator.ts
```

Should show:
```typescript
this.toolExecutor.registerTools([...queryTools, ...generationTools, ...workflowTools]);
```

## Next Steps

1. **Read the full documentation**: [server/agent/README.md](./server/agent/README.md)
2. **Review deployment guide**: [AGENT_DEPLOYMENT_GUIDE.md](./AGENT_DEPLOYMENT_GUIDE.md)
3. **Check implementation summary**: [AGENT_MODULE_SUMMARY.md](../AGENT_MODULE_SUMMARY.md)
4. **Integrate into your UI**: See [client/components/AgentChat.tsx](./client/components/AgentChat.tsx)

## Support

If you encounter issues:

1. Check the logs: `tail -f logs/server.log`
2. Verify database tables exist
3. Confirm API key is set
4. Review the troubleshooting section in [AGENT_DEPLOYMENT_GUIDE.md](./AGENT_DEPLOYMENT_GUIDE.md)

## What's Included

✅ **12 Tools** across 3 categories (query, generation, workflow)  
✅ **11 API Endpoints** for full agent functionality  
✅ **7 Database Tables** for conversations, learning, and audit  
✅ **Learning System** that improves from user feedback  
✅ **React UI Component** ready to embed  
✅ **Complete Documentation** with examples and guides  

---

**You're ready to go!** The agent is now available in your mce-tools application.
