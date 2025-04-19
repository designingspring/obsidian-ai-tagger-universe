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

interface OpenAICompatibleResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
        text?: string;
    }>;
    error?: {
        message: string;
    };
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

    public parseResponse(response: Record<string, unknown>): BaseResponse {
        try {
            const openaiResponse = response as OpenAICompatibleResponse;
            let content: string | undefined;
            
            // Handle different response formats
            if (openaiResponse.choices?.[0]?.message?.content) {
                content = openaiResponse.choices[0].message.content;
            } else if (openaiResponse.choices?.[0]?.text) {
                // Some OpenAI-compatible APIs might use 'text' instead of 'message.content'
                content = openaiResponse.choices[0].text;
            } else {
                throw new Error('Invalid response format: missing content');
            }

            if (!content) {
                throw new Error('Response content is empty');
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
