import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';

// Define specific interface for Groq responses
interface GroqResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    error?: {
        message: string;
    };
}

// Define specific interface for Groq error responses
interface GroqErrorResponse {
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

export class GroqAdapter extends BaseAdapter {
    private readonly defaultConfig = {
        temperature: 0.7,
        defaultModel: 'mixtral-8x7b-32768'
    };

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.groq
        });
        this.provider = {
            name: 'groq',
            requestFormat: {
                url: '/v1/chat/completions',
                headers: {},
                body: {
                    model: config.modelName || this.defaultConfig.defaultModel,
                    messages: [],
                    temperature: this.defaultConfig.temperature
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
            temperature: this.defaultConfig.temperature
        };
    }

    public parseResponse(response: Record<string, unknown>): BaseResponse {
        try {
            const groqResponse = response as GroqResponse;
            const content = groqResponse.choices?.[0]?.message?.content;
            
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
            throw new Error(`Failed to parse Groq response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for Groq';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for Groq';
        }
        return null;
    }

    public extractError(error: Record<string, unknown> | Error): string {
        if (error instanceof Error) {
            return error.message;
        }

        const errorObj = error as GroqErrorResponse;
        const message = 
            errorObj.error?.message ||
            errorObj.response?.data?.error?.message ||
            errorObj.message ||
            'Unknown error occurred';
        return message;
    }

    public getHeaders(): Record<string, string> {
        if (!this.config.apiKey) {
            throw new Error('API key is required for Groq');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };
    }
}
