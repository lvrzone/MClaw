/**
 * AI Service for Config Editor
 * Provides AI-powered config explanation, fixing, and improvement suggestions
 * Uses the user's configured AI providers
 */
import { useProviderStore } from '@/stores/providers';

export interface AiModelOption {
  accountId: string;
  providerName: string;
  model: string;
  baseUrl?: string;
  label: string;
}

export interface AiResponse {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Get available AI models from configured providers
 */
export function getAvailableModels(): AiModelOption[] {
  const store = useProviderStore.getState();
  const accounts = store.accounts ?? [];
  const models: AiModelOption[] = [];

  for (const account of accounts) {
    // Skip accounts without models
    if (!account.model && !account.fallbackModels?.length) continue;

    const modelsToAdd = account.fallbackModels?.length 
      ? account.fallbackModels 
      : account.model ? [account.model] : [];

    for (const model of modelsToAdd) {
      models.push({
        accountId: account.id,
        providerName: account.vendorId,
        model,
        baseUrl: account.baseUrl,
        label: `${account.vendorId} / ${model}`,
      });
    }
  }

  return models;
}

/**
 * Call AI model with a prompt
 */
export async function callAiModel(
  accountId: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  baseUrl?: string
): Promise<AiResponse> {
  try {
    // Get API key from store
    const apiKey = await useProviderStore.getState().getAccountApiKey(accountId);
    if (!apiKey) {
      return { success: false, error: 'API key not found for this provider' };
    }

    // Find account to get provider info
    const account = useProviderStore.getState().accounts.find(a => a.id === accountId);
    if (!account) {
      return { success: false, error: 'Provider account not found' };
    }

    // Determine API endpoint
    const endpoint = baseUrl || account.baseUrl || getDefaultEndpoint(account.vendorId);
    const isOllama = account.vendorId === 'ollama' || endpoint.includes('ollama');

    // Build request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!isOllama) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let body: Record<string, unknown>;

    if (isOllama) {
      // Ollama format
      body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
      };
    } else if (account.vendorId === 'anthropic') {
      // Anthropic format
      body = {
        model,
        messages: [
          { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` },
        ],
        max_tokens: 4096,
      };
    } else {
      // OpenAI-compatible format
      body = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      };
    }

    // Make API call
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    
    // Extract content based on response format
    let content: string;
    if (isOllama) {
      content = data.message?.content || '';
    } else if (account.vendorId === 'anthropic') {
      content = data.content?.[0]?.text || '';
    } else {
      content = data.choices?.[0]?.message?.content || '';
    }

    return { success: true, content };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function getDefaultEndpoint(vendorId: string): string {
  const endpoints: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    'google-generativeai': 'https://generativelanguage.googleapis.com/v1beta',
    'azure-openai': 'https://api.openai.com/v1',
    ollama: 'http://localhost:11434/api',
  };
  return endpoints[vendorId] || 'https://api.openai.com/v1';
}

// ── Config-specific AI prompts ──────────────────────────────────

const SYSTEM_PROMPTS = {
  explain: `你是一个配置文件助手，专门帮助用户理解配置文件的内容。
请用简洁的中文解释配置项的含义和作用。
对于 Markdown 格式的配置文件（如 SOUL.md、USER.md、IDENTITY.md 等），解释每个部分代表什么。
对于 JSON 格式的配置文件（如 openclaw.json、cron.json），解释每个键值的含义。
只返回解释内容，不要返回原始配置。`,

  fix: `你是一个配置文件错误修复助手，专门帮助用户修复配置文件中的语法错误。
请仔细检查配置文件的语法错误，并用中文说明问题所在和修复方法。
如果是 JSON 文件，确保语法正确；如果是 Markdown 文件，检查格式问题。
只返回错误说明和修复建议，不要直接修改文件。`,

  improve: `你是一个配置文件优化助手，专门帮助用户改进配置文件的结构和内容。
请用中文提供优化建议，包括：
1. 哪些地方可以改进
2. 建议添加哪些配置项
3. 当前的配置是否合理
4. 是否有潜在问题需要注意
只返回优化建议，不要直接修改文件。`,
};

/**
 * Get AI explanation for config content
 */
export async function explainConfig(
  content: string,
  fileType: 'json' | 'markdown',
  accountId: string,
  model: string,
  baseUrl?: string
): Promise<AiResponse> {
  const fileTypeLabel = fileType === 'json' ? 'JSON' : 'Markdown';
  const userPrompt = `请解释以下${fileTypeLabel}配置文件的内容，用中文简要说明每个部分的作用和含义：\n\n\`\`\`\n${content.slice(0, 4000)}\n\`\`\``;
  
  return callAiModel(accountId, model, SYSTEM_PROMPTS.explain, userPrompt, baseUrl);
}

/**
 * Get AI fix suggestions for config content
 */
export async function fixConfigErrors(
  content: string,
  fileType: 'json' | 'markdown',
  accountId: string,
  model: string,
  baseUrl?: string
): Promise<AiResponse> {
  const fileTypeLabel = fileType === 'json' ? 'JSON' : 'Markdown';
  const userPrompt = `请检查以下${fileTypeLabel}配置文件中的错误，用中文说明：\n1. 具体有哪些语法错误\n2. 错误在哪个位置\n3. 如何修复这些错误\n\n如果文件没有问题，请说明"配置文件语法正确，没有发现错误"。\n\n\`\`\`\n${content.slice(0, 4000)}\n\`\`\``;
  
  return callAiModel(accountId, model, SYSTEM_PROMPTS.fix, userPrompt, baseUrl);
}

/**
 * Get AI improvement suggestions for config content
 */
export async function improveConfig(
  content: string,
  fileType: 'json' | 'markdown',
  accountId: string,
  model: string,
  baseUrl?: string
): Promise<AiResponse> {
  const fileTypeLabel = fileType === 'json' ? 'JSON' : 'Markdown';
  const userPrompt = `请分析以下${fileTypeLabel}配置文件，提供改进建议。用中文说明：\n1. 当前配置的优点\n2. 存在的问题或风险\n3. 具体的改进建议\n4. 建议添加的优化配置\n\n\`\`\`\n${content.slice(0, 4000)}\n\`\`\``;
  
  return callAiModel(accountId, model, SYSTEM_PROMPTS.improve, userPrompt, baseUrl);
}
