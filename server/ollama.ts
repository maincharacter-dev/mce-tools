/**
 * Ollama Integration Module
 * 
 * Provides interface for interacting with local Ollama models
 * for fact extraction from renewable energy project documents.
 * 
 * Based on Solar Analyzer implementation.
 */

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // Base64 encoded images for vision models
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaGenerateOptions {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  format?: 'json' | object;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    num_ctx?: number;
    stop?: string[];
  };
}

/**
 * Get Ollama base URL from environment or default
 */
function getOllamaUrl(): string {
  return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
}

/**
 * Call Ollama chat completion API
 */
export async function ollamaChat(options: OllamaGenerateOptions): Promise<OllamaResponse> {
  const ollamaUrl = getOllamaUrl();
  const endpoint = `${ollamaUrl}/api/chat`;

  console.log(`[Ollama] Calling ${endpoint} with model ${options.model}`);
  console.log(`[Ollama] Message count: ${options.messages.length}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...options,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Ollama] Chat API error:', error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Ollama request timed out after 5 minutes.');
      }
      if (error.message.includes('ECONNREFUSED')) {
        throw new Error(`Cannot connect to Ollama at ${ollamaUrl}. Make sure Ollama is running.`);
      }
    }
    
    throw error;
  }
}

/**
 * Generate structured JSON output using Ollama
 */
export async function ollamaGenerateJSON<T = any>(
  model: string,
  prompt: string,
  systemPrompt?: string,
  options?: OllamaGenerateOptions['options']
): Promise<T> {
  const messages: OllamaMessage[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });

  const response = await ollamaChat({
    model,
    messages,
    format: 'json',
    options,
  });

  console.log(`[Ollama] Response received: ${response.message.content.length} chars`);
  console.log(`[Ollama] Generation time: ${response.total_duration ? (response.total_duration / 1e9).toFixed(2) + 's' : 'unknown'}`);

  try {
    const parsed = JSON.parse(response.message.content);
    return parsed;
  } catch (error) {
    console.error('[Ollama] Failed to parse JSON response');
    console.error('[Ollama] Raw response (first 500 chars):', response.message.content.substring(0, 500));
    throw new Error(`Ollama returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if Ollama is available and running
 */
export async function checkOllamaHealth(): Promise<boolean> {
  const ollamaUrl = getOllamaUrl();
  
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error('[Ollama] Health check failed:', error);
    return false;
  }
}

/**
 * List available Ollama models
 */
export async function listOllamaModels(): Promise<string[]> {
  const ollamaUrl = getOllamaUrl();
  
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }
    
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch (error) {
    console.error('[Ollama] Failed to list models:', error);
    return [];
  }
}

/**
 * Extract facts from document text using Ollama
 */
export async function extractFactsWithOllama(
  documentText: string,
  documentType: string,
  model: string = 'llama3.2:latest'
): Promise<any> {
  const systemPrompt = `You are an expert renewable energy project analyst. Extract structured facts from project documents.
Focus on:
- Project specifications (capacity, technology, location)
- Key dates and milestones
- Financial information
- Technical requirements
- Grid connection details
- Planning and permitting status
- Risk factors

Return JSON with extracted facts, confidence scores (0-1), and source references.`;

  const userPrompt = `Document Type: ${documentType}

Extract all relevant facts from the following document text:

${documentText.substring(0, 50000)} 

Return JSON format:
{
  "facts": [
    {
      "category": "specification|financial|technical|planning|risk",
      "key": "fact_name",
      "value": "fact_value",
      "confidence": 0.95,
      "source": "quote from document"
    }
  ]
}`;

  return await ollamaGenerateJSON(model, userPrompt, systemPrompt, {
    temperature: 0.1, // Low temperature for factual extraction
    num_ctx: 8192, // Large context window for documents
  });
}
