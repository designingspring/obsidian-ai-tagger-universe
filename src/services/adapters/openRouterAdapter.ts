import { BaseAdapter } from './baseAdapter';
import { BaseResponse, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';

// Define specific interface for OpenRouter responses
interface OpenRouterResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    error?: {
        message: string;
    };
}

// Define specific interface for OpenRouter error responses
interface OpenRouterErrorResponse {
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
    message?: string;
}

export class OpenRouterAdapter extends BaseAdapter {
    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.openrouter
        });
        this.provider = {
            name: 'openrouter',
            requestFormat: {
                body: {
                    model: this.config.modelName
                }
            },
            responseFormat: {
                path: ['choices', '0', 'message', 'content'],
                errorPath: ['error', 'message']
            }
        };
    }

    protected override _parseResponseInternal(response: unknown): BaseResponse {
        try {
            const openRouterResponse = response as OpenRouterResponse;
            const content = openRouterResponse.choices?.[0]?.message?.content;
            
            if (!content) {
                throw new Error('Invalid response format: missing content');
            }

            const jsonContent = this.extractJsonFromContent(content);

            if (!Array.isArray(jsonContent?.matchedTags) || !Array.isArray(jsonContent?.newTags)) {
                throw new Error('Invalid response format: missing required arrays');
            }

            return {
                text: content,
                matchedExistingTags: jsonContent.matchedTags,
                suggestedTags: jsonContent.newTags
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse OpenRouter response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for OpenRouter';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for OpenRouter';
        }
        if (!this.config.modelName) {
            return 'Model name is required for OpenRouter';
        }
        return null;
    }

    public extractError(error: Record<string, unknown> | Error): string {
        if (error instanceof Error) {
            return error.message;
        }

        const errorObj = error as OpenRouterErrorResponse;
        return errorObj.error?.message ||
            errorObj.response?.data?.error?.message ||
            errorObj.message ||
            'Unknown error occurred';
    }

    public getHeaders(): Record<string, string> {
        if (!this.config.apiKey) {
            throw new Error('API key is required for OpenRouter');
        }
        return {
            ...super.getHeaders(),
            'Authorization': `Bearer ${this.config.apiKey}`,
            'HTTP-Referer': 'https://github.com/obsidian-ai-tagger',
            'X-Title': 'Obsidian AI Tagger'
        };
    }
}
