import { BaseAdapter } from './baseAdapter';
import { TAG_SYSTEM_PROMPT } from '../prompts/tagPrompts';
import { BaseResponse, RequestBody, AdapterConfig } from './types';

// Define additional types for OpenAI-compatible requests and responses
interface OpenAICompatibleRequestExtension {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string[];
    [key: string]: unknown;
}

interface OpenAICompatibleErrorResponse {
    response?: {
        data?: {
            error?: {
                message: string;
            };
            message?: string;
        };
    };
    message?: string;
}

export class OpenAICompatibleAdapter extends BaseAdapter {
    constructor(config: AdapterConfig) {
        super(config);
        this.provider = {
            name: 'openai-compatible',
            requestFormat: {
                url: config.endpoint || '/v1/chat/completions',
                headers: {},
                body: {
                    model: this.config.modelName,
                    messages: []
                }
            },
            responseFormat: {
                path: ['choices', '0', 'message', 'content'],
                errorPath: ['error', 'message']
            }
        };
    }

    public formatRequest(prompt: string): RequestBody & OpenAICompatibleRequestExtension {
        const body: RequestBody & OpenAICompatibleRequestExtension = {
            model: this.config.modelName,
            messages: [{
                role: 'system',
                content: TAG_SYSTEM_PROMPT
            }, {
                role: 'user',
                content: prompt
            }]
        };

        // Add any additional parameters from config
        for (const [key, value] of Object.entries(this.config)) {
            if (!['endpoint', 'apiKey', 'modelName'].includes(key)) {
                body[key] = value;
            }
        }

        return body;
    }

    protected override _parseResponseInternal(response: unknown): BaseResponse {
        try {
            const responseObj = response as Record<string, unknown>;
            const choices = responseObj.choices as Array<{message?: {content?: string}}> | undefined;
            
            if (!choices || !Array.isArray(choices) || choices.length === 0) {
                throw new Error('Invalid response format: missing choices array');
            }
            
            const content = choices[0]?.message?.content;
            if (!content) {
                throw new Error('Invalid response format: missing content');
            }
            
            // Try to extract JSON from content
            try {
                const jsonContent = this.extractJsonFromContent(content);
                
                // Check for expected fields
                const matchedTags = Array.isArray(jsonContent.matchedTags) ? jsonContent.matchedTags : [];
                const newTags = Array.isArray(jsonContent.newTags) ? jsonContent.newTags : [];
                
                return {
                    text: content,
                    matchedExistingTags: matchedTags,
                    suggestedTags: newTags
                };
            } catch (jsonError) {
                // If we failed to parse JSON, return the content with empty tags
                return {
                    text: content,
                    matchedExistingTags: [],
                    suggestedTags: []
                };
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required';
        }
        if (!this.config.modelName) {
            return 'Model name is required';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required';
        }
        return null;
    }

    public extractError(error: Record<string, unknown> | Error): string {
        if (error instanceof Error) {
            return error.message;
        }
        
        const errorObj = error as OpenAICompatibleErrorResponse;
        // Handle different error response formats
        if (errorObj.response?.data?.error?.message) {
            return errorObj.response.data.error.message;
        }
        if (errorObj.response?.data?.message) {
            return errorObj.response.data.message;
        }
        return errorObj.message || 'Unknown error occurred';
    }

    public getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            ...(this.provider?.requestFormat.headers || {})
        };
    }
}
