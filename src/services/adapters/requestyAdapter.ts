import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';

// Define interface for Requesty response structure
interface RequestyResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    error?: {
        message: string;
    };
}

export class RequestyAdapter extends BaseAdapter {
    private readonly defaultConfig = {
        temperature: 0.7,
        max_tokens: 1024
    };

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.requesty
        });
        this.provider = {
            name: 'requesty',
            requestFormat: {
                url: '/v1/chat/completions',
                headers: {},
                body: {
                    model: config.modelName,
                    messages: [],
                    ...this.defaultConfig
                }
            },
            responseFormat: {
                path: ['choices', '0', 'message', 'content'],
                errorPath: ['error', 'message']
            }
        };
    }

    public formatRequest(prompt: string): RequestBody {
        const baseRequest = super.formatRequest(prompt);
        
        return {
            ...baseRequest,
            ...this.defaultConfig
        };
    }

    protected override _parseResponseInternal(response: unknown): BaseResponse {
        try {
            const requestyResponse = response as RequestyResponse;
            if (requestyResponse.error) {
                throw new Error(requestyResponse.error.message || 'Unknown error');
            }

            // Extract the content (choices[0].message.content)
            const content = requestyResponse.choices?.[0]?.message?.content;
            if (!content) {
                throw new Error('Invalid response format: missing content');
            }

            // Extract tags from content
            let matchedTags: string[] = [];
            let newTags: string[] = [];

            try {
                const jsonContent = this.extractJsonFromContent(content);
                matchedTags = Array.isArray(jsonContent.matchedTags) ? jsonContent.matchedTags : [];
                newTags = Array.isArray(jsonContent.newTags) ? jsonContent.newTags : [];
            } catch (jsonError) {
                // Fallback - if JSON extraction fails, just return empty arrays
                newTags = [];
            }

            return {
                text: content,
                matchedExistingTags: matchedTags,
                suggestedTags: newTags
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse Requesty response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for Requesty AI';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for Requesty AI';
        }
        if (!this.config.modelName) {
            return 'Model name is required for Requesty AI';
        }
        return null;
    }

    public extractError(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        
        const errorObj = error as Record<string, unknown>;
        const errorProp = errorObj.error as Record<string, unknown> | undefined;
        
        if (errorProp?.message && typeof errorProp.message === 'string') {
            return errorProp.message;
        }
        
        const response = errorObj.response as Record<string, unknown> | undefined;
        const data = response?.data as Record<string, unknown> | undefined;
        const dataError = data?.error as Record<string, unknown> | undefined;
        
        if (dataError?.message && typeof dataError.message === 'string') {
            return dataError.message;
        }
        
        if (errorObj.message && typeof errorObj.message === 'string') {
            return errorObj.message;
        }
        
        return 'Unknown error occurred';
    }

    public getHeaders(): Record<string, string> {
        if (!this.config.apiKey) {
            throw new Error('API key is required for Requesty AI');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            ...(this.provider?.requestFormat.headers || {})
        };
    }
}
