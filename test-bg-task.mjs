/**
 * Test script to capture ALL SSE events from Sprocket for a complex query
 * that triggers background tasks (knowledge graph search, tool use, etc.)
 */
import 'dotenv/config';

const SPROCKET_URL = process.env.SPROCKET_URL;
const SPROCKET_USERNAME = process.env.SPROCKET_USERNAME;
const SPROCKET_PASSWORD = process.env.SPROCKET_PASSWORD;

// Login
const loginRes = await fetch(`${SPROCKET_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: SPROCKET_USERNAME, password: SPROCKET_PASSWORD }),
});
const setCookie = loginRes.headers.get('set-cookie');
const match = setCookie?.match(/app_session_id=([^;]+)/);
const cookie = match ? `app_session_id=${match[1]}` : '';
console.log('Logged in, cookie:', cookie.substring(0, 30));

// Use a query that triggers tools/background tasks
const query = "Search the AEMO knowledge graph for information about NEM market risks. Use your tools to retrieve data.";
console.log('\nQuery:', query);
console.log('Streaming events:\n---');

const streamRes = await fetch(`${SPROCKET_URL}/api/chat/stream`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
  body: JSON.stringify({ message: query, userId: 1 }),
});

const reader = streamRes.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let eventCount = 0;
let eventType = '';
let eventData = '';

const startTime = Date.now();

while (true) {
  const { done, value } = await reader.read();
  if (done) {
    console.log('\n--- Stream ended (reader.done) ---');
    break;
  }
  
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      eventData = line.slice(6).trim();
    } else if (line === '' && eventType) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[${elapsed}s] event: ${eventType}`);
      try {
        const parsed = JSON.parse(eventData);
        if (eventType === 'token') {
          process.stdout.write('  content: ' + (parsed.content || '').substring(0, 60) + '\n');
        } else if (eventType === 'status') {
          console.log(`  phase=${parsed.phase} text="${parsed.text}"`);
        } else {
          console.log('  data:', JSON.stringify(parsed).substring(0, 120));
        }
      } catch {
        console.log('  raw:', eventData.substring(0, 80));
      }
      eventCount++;
      eventType = '';
      eventData = '';
    }
  }
}

console.log(`\nTotal events: ${eventCount}`);
console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
