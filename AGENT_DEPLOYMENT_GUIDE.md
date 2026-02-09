# AI Agent Module - Deployment Guide

## Overview

This guide covers deploying the AI Agent module within the MCE Tools ecosystem. The agent is fully integrated into the existing application and requires minimal additional configuration.

## Prerequisites

- Node.js 22.x or higher
- MySQL/TiDB database (existing MCE database)
- OpenAI API key or Manus Forge API access
- Existing MCE Tools application running

## Installation Steps

### 1. Database Migration

Run the agent table migration to create required tables:

```bash
# Navigate to project root
cd /home/ubuntu/mce-tools

# Run the migration SQL script
mysql -u your_username -p your_database < server/agent/migrations/001_create_agent_tables.sql

# Or use Drizzle Kit
pnpm db:push
```

This creates the following tables:
- `agent_conversations`
- `agent_messages`
- `agent_actions`
- `agent_style_models`
- `agent_learning_samples`
- `agent_knowledge_base`
- `agent_generated_content`

### 2. Environment Configuration

Ensure your `.env` file includes the necessary LLM API configuration:

```bash
# OpenAI API (if using OpenAI directly)
OPENAI_API_KEY=sk-your-openai-key-here

# Or Manus Forge API (default)
FORGE_API_KEY=your-forge-api-key
FORGE_API_URL=https://forge.manus.im
```

The agent will automatically use OpenAI if `OPENAI_API_KEY` starts with `sk-`, otherwise it uses Manus Forge.

### 3. Verify Installation

Check that the agent router is properly registered:

```bash
# Check server/routers.ts
grep "agent: agentRouter" server/routers.ts
```

Expected output:
```typescript
agent: agentRouter,
```

### 4. Build and Start

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

### 5. Verify Agent is Running

Test the agent API endpoint:

```bash
# Using curl (replace with your auth token)
curl -X POST http://localhost:5173/trpc/agent.chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "projectId": 1,
    "message": "Hello, what can you help me with?"
  }'
```

Or use the frontend UI by navigating to your project and opening the agent chat interface.

## Frontend Integration

### Adding Agent Chat to a Page

```typescript
import { AgentChat } from "@/components/AgentChat";

function ProjectPage({ projectId }: { projectId: number }) {
  return (
    <div className="container mx-auto p-4">
      <h1>Project Dashboard</h1>
      
      {/* Agent Chat Component */}
      <AgentChat
        projectId={projectId}
        onConversationCreated={(conversationId) => {
          console.log("Conversation created:", conversationId);
        }}
      />
    </div>
  );
}
```

### Using Agent API Directly

```typescript
import { trpc } from "@/lib/trpc";

// Send a message
const { data } = await trpc.agent.chat.mutate({
  projectId: 123,
  message: "Show me all high-risk facts",
});

console.log(data.message);
console.log(data.toolsUsed);

// Get conversations
const { data: conversations } = await trpc.agent.getConversations.query({
  projectId: 123,
});

// Submit edit for learning
await trpc.agent.submitEdit.mutate({
  contentId: "abc-123",
  finalContent: "Edited content...",
  feedback: "More technical detail needed",
});
```

## Configuration Options

### Tool Registration

To enable/disable specific tools, modify `server/agent/agent-orchestrator.ts`:

```typescript
// Enable all tools (default)
this.toolExecutor.registerTools([
  ...queryTools,
  ...generationTools,
  ...workflowTools,
]);

// Enable only query and workflow tools
this.toolExecutor.registerTools([
  ...queryTools,
  ...workflowTools,
]);
```

### LLM Model Selection

The agent uses different models based on the API provider:

- **OpenAI**: `gpt-4o-mini` (configurable in `server/_core/llm.ts`)
- **Manus Forge**: `gemini-2.5-flash` (default)

To change the model, edit `server/_core/llm.ts`:

```typescript
const model = useOpenAI ? "gpt-4o" : "gemini-2.5-flash";
```

### Response Time Limits

Adjust timeout settings in `server/_core/llm.ts`:

```typescript
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
```

## Monitoring and Logging

### Agent Actions Log

All agent actions are logged to the `agent_actions` table:

```sql
SELECT 
  action_type,
  action_name,
  success,
  execution_time_ms,
  created_at
FROM agent_actions
WHERE project_id = 123
ORDER BY created_at DESC
LIMIT 100;
```

### Conversation Analytics

Get conversation statistics:

```typescript
const stats = await trpc.agent.getConversationStats.query({
  conversationId: "abc-123",
});

console.log(stats.messageCount);
console.log(stats.totalTokens);
console.log(stats.averageLatency);
```

### Learning Progress

Track learning improvement:

```typescript
const stats = await trpc.agent.getLearningStats.query();

console.log(stats.totalEdits);
console.log(stats.averageEditDistance);
console.log(stats.improvementScore);
console.log(stats.styleModelVersion);
```

## Performance Optimization

### Database Indexing

Ensure indexes are created for optimal performance:

```sql
-- Conversation queries
CREATE INDEX idx_user_project ON agent_conversations(user_id, project_id);
CREATE INDEX idx_updated_at ON agent_conversations(updated_at);

-- Message queries
CREATE INDEX idx_conversation ON agent_messages(conversation_id);

-- Action queries
CREATE INDEX idx_action_type ON agent_actions(action_type);
CREATE INDEX idx_created_at ON agent_actions(created_at);
```

### Caching

Implement caching for frequently accessed data:

```typescript
// Example: Cache project summary
const cache = new Map<number, any>();

async function getCachedProjectSummary(projectId: number) {
  if (cache.has(projectId)) {
    return cache.get(projectId);
  }
  
  const summary = await agent.processMessage({
    userId: 1,
    projectId,
    message: "Get project summary",
  });
  
  cache.set(projectId, summary);
  setTimeout(() => cache.delete(projectId), 5 * 60 * 1000); // 5 min TTL
  
  return summary;
}
```

### Rate Limiting

Implement rate limiting to prevent abuse:

```typescript
import rateLimit from "express-rate-limit";

const agentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user to 100 requests per window
  message: "Too many requests, please try again later.",
});

// Apply to agent endpoints
app.use("/trpc/agent", agentLimiter);
```

## Security Considerations

### Data Isolation

The agent enforces strict project-level data isolation:

- All queries are scoped to `projectId`
- Users can only access their own conversations
- Project database connections are isolated

### Audit Trail

All agent actions are logged with:
- User ID
- Project ID
- Action type and name
- Input/output data
- Success/failure status
- Execution time

### API Key Security

**Never expose API keys in frontend code:**

```typescript
// ❌ BAD - Don't do this
const apiKey = "sk-...";

// ✅ GOOD - API keys stay on server
// The agent orchestrator handles LLM calls server-side
```

## Troubleshooting

### Agent Not Responding

**Symptoms:** Agent chat returns errors or times out

**Solutions:**
1. Check database connection:
   ```bash
   mysql -u user -p -e "SELECT 1 FROM agent_conversations LIMIT 1;"
   ```

2. Verify API key is set:
   ```bash
   echo $OPENAI_API_KEY
   # or
   echo $FORGE_API_KEY
   ```

3. Check server logs:
   ```bash
   tail -f logs/server.log | grep "Agent"
   ```

### Tools Not Executing

**Symptoms:** Agent responds but doesn't use tools

**Solutions:**
1. Verify tools are registered:
   ```typescript
   console.log(toolExecutor.getToolNames());
   ```

2. Check tool validation:
   ```typescript
   const validation = toolExecutor.validateArguments("query_facts", {
     category: "technical",
   });
   console.log(validation);
   ```

3. Review action logs:
   ```sql
   SELECT * FROM agent_actions WHERE success = 0 ORDER BY created_at DESC LIMIT 10;
   ```

### Learning Not Working

**Symptoms:** Style model not updating after edits

**Solutions:**
1. Verify content ID exists:
   ```sql
   SELECT * FROM agent_generated_content WHERE id = 'your-content-id';
   ```

2. Check learning samples:
   ```sql
   SELECT COUNT(*) FROM agent_learning_samples WHERE user_id = 1;
   ```

3. Manually trigger learning:
   ```typescript
   await agent.submitEdit(contentId, finalContent, "Manual trigger");
   ```

### High Latency

**Symptoms:** Agent responses take >10 seconds

**Solutions:**
1. Check LLM API latency:
   ```typescript
   const start = Date.now();
   await invokeLLM({ messages: [...] });
   console.log(`LLM latency: ${Date.now() - start}ms`);
   ```

2. Optimize database queries:
   ```sql
   EXPLAIN SELECT * FROM extracted_facts WHERE project_id = 123;
   ```

3. Reduce conversation history:
   ```typescript
   // In agent-orchestrator.ts
   const history = await this.conversationManager.buildLLMContext(
     conversationId,
     10 // Reduce from 20 to 10
   );
   ```

## Scaling Considerations

### Horizontal Scaling

The agent module is stateless and can be scaled horizontally:

1. **Load Balancer**: Distribute requests across multiple instances
2. **Session Affinity**: Not required (conversations stored in database)
3. **Database Connection Pool**: Configure per instance

```typescript
// db-connection.ts
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10, // Adjust based on load
});
```

### Vertical Scaling

For single-instance deployments:

1. **Increase Memory**: Agent holds conversation context in memory
2. **Optimize Database**: Use read replicas for query-heavy workloads
3. **Cache Results**: Implement Redis for frequently accessed data

### Queue-Based Processing

For high-volume scenarios, use a queue:

```typescript
import Bull from "bull";

const agentQueue = new Bull("agent-messages", {
  redis: { host: "localhost", port: 6379 },
});

agentQueue.process(async (job) => {
  const { userId, projectId, message } = job.data;
  return await agent.processMessage({ userId, projectId, message });
});

// Add to queue instead of direct processing
await agentQueue.add({ userId, projectId, message });
```

## Maintenance

### Regular Tasks

1. **Clean old conversations** (monthly):
   ```sql
   DELETE FROM agent_conversations 
   WHERE status = 'archived' 
   AND updated_at < DATE_SUB(NOW(), INTERVAL 6 MONTH);
   ```

2. **Archive action logs** (weekly):
   ```sql
   INSERT INTO agent_actions_archive 
   SELECT * FROM agent_actions 
   WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
   
   DELETE FROM agent_actions 
   WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
   ```

3. **Update knowledge base** (as needed):
   ```sql
   INSERT INTO agent_knowledge_base (id, category, topic, content, confidence)
   VALUES (UUID(), 'domain_knowledge', 'New Topic', 'Content...', 'high');
   ```

### Backup Strategy

Include agent tables in regular backups:

```bash
mysqldump -u user -p database_name \
  agent_conversations \
  agent_messages \
  agent_actions \
  agent_style_models \
  agent_learning_samples \
  agent_knowledge_base \
  agent_generated_content \
  > agent_backup_$(date +%Y%m%d).sql
```

## Support

For issues or questions:

1. Check the [README](./server/agent/README.md) for usage examples
2. Review server logs for error messages
3. Consult the [technical brief](./OE_AGENT_MODULE_BRIEF.md) for architecture details
4. Submit issues to the repository

## Version History

- **v1.0.0** (2026-02-10): Initial release
  - Core agent functionality
  - Query, generation, and workflow tools
  - Learning engine and style adaptation
  - tRPC API integration
  - React UI component
