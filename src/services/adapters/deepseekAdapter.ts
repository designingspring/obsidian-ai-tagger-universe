import { BaseAdapter } from './baseAdapter';
import { BaseResponse, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';
import { TaggingMode } from '../prompts/types';
import { LLMResponse } from '../types';

// Define specific interface for Deepseek responses
interface DeepseekResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message: string;
  };
}

export class DeepseekAdapter extends BaseAdapter {
  constructor(config: AdapterConfig) {
    super({
      ...config,
      endpoint: config.endpoint || endpoints.deepseek,
      modelName: config.modelName || 'deepseek-chat'
    });
    this.provider = {
      name: 'deepseek',
      requestFormat: {
        body: {
          model: this.modelName
        }
      },
      responseFormat: {
        path: ['choices', '0', 'message', 'content'],
        errorPath: ['error', 'message']
      }
    };
  }

  getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  private readonly defaultConfig = {
    defaultModel: 'deepseek-chat'
  };

  public validateConfig(): string | null {
    const baseValidation = super.validateConfig();
    if (baseValidation) return baseValidation;
    
    if (!this.config.apiKey) {
      return 'API key is required for Deepseek';
    }
    return null;
  }

  parseResponse(response: string, mode: TaggingMode, maxTags: number): LLMResponse {
    try {
      // Parse the response to JSON first
      const jsonResponse = JSON.parse(response) as Record<string, unknown>;
      // Use the internal method to process the response
      const baseResponse = this._parseResponse(jsonResponse);
      
      // Convert to LLMResponse format
      return {
        matchedExistingTags: baseResponse.matchedExistingTags || [],
        suggestedTags: baseResponse.suggestedTags || [],
        tags: [...(baseResponse.matchedExistingTags || []), ...(baseResponse.suggestedTags || [])]
      };
    } catch (error) {
      // Fall back to the base implementation
      return super.parseResponse(response, mode, maxTags);
    }
  }

  // Override the internal parse method for Deepseek-specific logic
  protected override _parseResponseInternal(response: unknown): BaseResponse {
    try {
      const deepseekResponse = response as DeepseekResponse;
      let result: unknown = response;
      let content = '';
      
      // 先获取原始的响应内容
      if (deepseekResponse.choices?.[0]?.message?.content) {
        content = deepseekResponse.choices[0].message.content;
      }
      
      // 解析结构化数据
      for (const key of this.provider.responseFormat.path) {
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid response structure');
        }
        result = (result as Record<string | number, unknown>)[key];
      }
      
      // 提取标签数据
      const jsonContent = this.extractJsonFromContent(content);
      
      return {
        text: content,
        matchedExistingTags: Array.isArray(jsonContent.matchedTags) 
          ? jsonContent.matchedTags.map(String)
          : [],
        suggestedTags: Array.isArray(jsonContent.newTags)
          ? jsonContent.newTags.map(String)
          : []
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse Deepseek response: ${message}`);
    }
  }
}
