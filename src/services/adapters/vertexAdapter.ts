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

    protected override _parseResponseInternal(response: unknown): BaseResponse {
        try {
            const vertexResponse = response as Record<string, unknown>;
            // Extract the content from the Vertex AI response
            const predictions = vertexResponse.predictions as Array<Record<string, unknown>>;
            
            if (!predictions || !Array.isArray(predictions) || predictions.length === 0) {
                throw new Error('Invalid response format: missing predictions');
            }
            
            const firstPrediction = predictions[0];
            // For Gemini model
            if (firstPrediction.content) {
                const parts = firstPrediction.content as Record<string, unknown>;
                const partsList = parts.parts as Array<Record<string, unknown>>;
                if (!partsList || !Array.isArray(partsList) || partsList.length === 0) {
                    throw new Error('Invalid response format: missing parts');
                }
                const text = partsList[0].text as string;
                if (!text) {
                    throw new Error('Invalid response format: missing text');
                }
                
                // Try to extract JSON from the text
                try {
                    const jsonContent = this.extractJsonFromContent(text);
                    return {
                        text: text,
                        matchedExistingTags: Array.isArray(jsonContent.matchedTags) ? jsonContent.matchedTags : [],
                        suggestedTags: Array.isArray(jsonContent.newTags) ? jsonContent.newTags : []
                    };
                } catch (jsonError) {
                    // If JSON extraction fails, return the text with empty tags
                    return {
                        text: text,
                        matchedExistingTags: [],
                        suggestedTags: []
                    };
                }
            }
            
            // For PaLM model
            if (typeof firstPrediction.content === 'string') {
                const content = firstPrediction.content as string;
                
                // Try to extract JSON from the content
                try {
                    const jsonContent = this.extractJsonFromContent(content);
                    return {
                        text: content,
                        matchedExistingTags: Array.isArray(jsonContent.matchedTags) ? jsonContent.matchedTags : [],
                        suggestedTags: Array.isArray(jsonContent.newTags) ? jsonContent.newTags : []
                    };
                } catch (jsonError) {
                    // If JSON extraction fails, return the content with empty tags
                    return {
                        text: content,
                        matchedExistingTags: [],
                        suggestedTags: []
                    };
                }
            }
            
            throw new Error('Invalid response format: unsupported Vertex AI model response');
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
