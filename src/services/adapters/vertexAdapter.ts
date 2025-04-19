import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';
import { TAG_SYSTEM_PROMPT } from '../prompts/tagPrompts';

// Define more specific types for Vertex API error responses
interface VertexErrorResponse {
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

export class VertexAdapter extends BaseAdapter {
    private readonly defaultConfig = {
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.8,
        topK: 40
    };

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.vertex
        });
        this.provider = {
            name: 'vertex',
            requestFormat: {
                url: '/predict',
                headers: {},
                body: {
                    instances: [{
                        messages: []
                    }],
                    parameters: this.defaultConfig
                }
            },
            responseFormat: {
                path: ['predictions', '0', 'candidates', '0', 'content'],
                errorPath: ['error', 'message']
            }
        };
    }

    public formatRequest(prompt: string): RequestBody {
        const messages = [
            {
                role: 'system',
                content: TAG_SYSTEM_PROMPT
            },
            {
                role: 'user',
                content: prompt
            }
        ];
        
        // 使用基本的格式化后添加 Vertex AI 特定的字段
        const baseRequest = super.formatRequest(prompt);
        
        return {
            ...baseRequest,
            model: this.config.modelName || 'gemini-pro',
            maxTokens: this.defaultConfig.maxOutputTokens,
            ...this.defaultConfig,
            _vertex: {
                instances: [{
                    messages: messages.map(m => ({
                        author: m.role,
                        content: m.content
                    }))
                }],
                parameters: this.defaultConfig
            }
        };
    }

    public parseResponse(response: Record<string, unknown>): BaseResponse {
        try {
            // Use a safer type assertion with proper type checking
            const predictions = response.predictions as unknown;
            if (!predictions || !Array.isArray(predictions)) {
                throw new Error('Invalid response format: missing predictions array');
            }
            
            const firstPrediction = predictions[0] as Record<string, unknown>;
            if (!firstPrediction) {
                throw new Error('Invalid response format: empty predictions array');
            }
            
            const candidates = firstPrediction.candidates as unknown;
            if (!candidates || !Array.isArray(candidates)) {
                throw new Error('Invalid response format: missing candidates array');
            }
            
            const firstCandidate = candidates[0] as Record<string, unknown>;
            if (!firstCandidate) {
                throw new Error('Invalid response format: empty candidates array');
            }
            
            const content = firstCandidate.content as string;
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
            throw new Error(`Failed to parse Vertex AI response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for Vertex AI';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for Vertex AI';
        }
        return null;
    }

    public extractError(error: Record<string, unknown> | Error): string {
        if (error instanceof Error) {
            return error.message;
        }

        const errorObj = error as VertexErrorResponse;
        const message = 
            errorObj.error?.message ||
            errorObj.response?.data?.error?.message ||
            'Unknown error occurred';
            
        return message;
    }

    public getHeaders(): Record<string, string> {
        if (!this.config.apiKey) {
            throw new Error('API key is required for Vertex AI');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'x-goog-user-project': this.extractProjectId(),
            'x-goog-api-key': this.config.apiKey
        };
    }

    private extractProjectId(): string {
        const match = this.config.endpoint?.match(/projects\/([^/]+)/);
        return match?.[1] || '';
    }
}
