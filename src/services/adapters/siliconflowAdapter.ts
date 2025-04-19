import { BaseAdapter } from "./baseAdapter";
import { AdapterConfig, RequestBody, BaseResponse } from "./types";
import { ConnectionTestResult, ConnectionTestError } from "../types";

// Define more specific types for Siliconflow error responses
interface SiliconflowErrorResponse {
  error?: {
    message: string;
  };
  response?: {
    data?: {
      error?: {
        message: string;
      };
    };
  };
}

export class SiliconflowAdapter extends BaseAdapter {
  constructor(config: AdapterConfig) {
    super(config);
    this.provider = {
      name: 'siliconflow',
      requestFormat: {
        url: '/v1/chat/completions',
        headers: {},
        body: {
          model: this.config.modelName,
          messages: []
        }
      },
      responseFormat: {
        path: ['choices', 0, 'message', 'content'],
        errorPath: ['error', 'message']
      }
    };
  }

  getHeaders(): Record<string, string> {
    if (!this.config.apiKey) {
      throw new Error('API key is required for Siliconflow');
    }
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  formatRequest(prompt: string): RequestBody {
    return {
      model: this.config.modelName || 'siliconflow-chat',
      messages: [{
        role: 'user',
        content: prompt
      }]
    };
  }

  public validateConfig(): string | null {
    const baseValidation = super.validateConfig();
    if (baseValidation) return baseValidation;
    
    if (!this.config.apiKey) {
      return 'API key is required for Siliconflow';
    }
    return null;
  }

  async testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }> {
    try {
      const response = await fetch(`${this.getEndpoint()}/v1/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(this.formatRequest('test'))
      });
      
      if (!response.ok) {
        const errorData = await response.json() as SiliconflowErrorResponse;
        return { 
          result: ConnectionTestResult.Failed, 
          error: {
            type: "network",
            message: errorData.error?.message || 'Connection test failed'
          }
        };
      }
      
      return { result: ConnectionTestResult.Success };
    } catch (error) {
      return { 
        result: ConnectionTestResult.Failed, 
        error: {
          type: "unknown",
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  protected override _parseResponseInternal(response: unknown): BaseResponse {
    try {
      let result: unknown = response;
      for (const key of this.provider.responseFormat.path) {
        if (result === null || typeof result !== 'object') {
          throw new Error('Invalid response structure');
        }
        result = (result as Record<string | number, unknown>)[key];
      }
      
      const content = result as string;
      if (typeof content !== 'string') {
        throw new Error('Invalid response content type');
      }
      
      return {
        text: content,
        matchedExistingTags: [],
        suggestedTags: []
      };
    } catch (error) {
      throw new Error('Failed to parse Siliconflow response');
    }
  }
}
