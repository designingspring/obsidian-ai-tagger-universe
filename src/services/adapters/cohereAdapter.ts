import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';

export class CohereAdapter extends BaseAdapter {
    private readonly defaultConfig = {
        temperature: 0.7,
        chat_history: [],
        stream: false
    };

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.cohere
        });
        this.provider = {
            name: 'cohere',
            requestFormat: {
                url: '/v1/chat',
                headers: {},
                body: {
                    model: config.modelName,
                    message: '',
                    ...this.defaultConfig
                }
            },
            responseFormat: {
                path: ['text'],
                errorPath: ['message']
            }
        };
    }

    public formatRequest(prompt: string): RequestBody {
        const baseRequest = super.formatRequest(prompt);
        
        return {
            ...baseRequest,
            message: prompt,
            ...this.defaultConfig,
            connectors: []
        };
    }

    protected override _parseResponseInternal(response: unknown): BaseResponse {
        try {
            const responseObj = response as Record<string, unknown>;
            const generationsArr = responseObj.generations as Array<{text?: string}> | undefined;
            
            if (!generationsArr || !Array.isArray(generationsArr) || generationsArr.length === 0) {
                throw new Error('Invalid response format: missing generations array');
            }
            
            const content = generationsArr[0]?.text;
            if (!content) {
                throw new Error('Invalid response format: missing text in first generation');
            }
            
            // Try to extract JSON from the content
            try {
                const jsonContent = this.extractJsonFromContent(content);
                
                return {
                    text: content,
                    matchedExistingTags: Array.isArray(jsonContent.matchedTags) ? jsonContent.matchedTags : [],
                    suggestedTags: Array.isArray(jsonContent.newTags) ? jsonContent.newTags : []
                };
            } catch (jsonError) {
                // If we failed to extract JSON, try to manually parse tags
                // Return empty arrays rather than trying to extract tags from text
                // since the extractTagsFromText method is private
                return {
                    text: content,
                    matchedExistingTags: [],
                    suggestedTags: []
                };
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse Cohere response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for Cohere';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for Cohere';
        }
        if (!this.config.modelName) {
            return 'Model name is required for Cohere';
        }
        return null;
    }

    public extractError(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        
        const errorObj = error as Record<string, unknown>;
        
        // Check if message exists directly
        if (typeof errorObj.message === 'string') {
            return errorObj.message;
        }
        
        // Check for nested response data
        const response = errorObj.response as Record<string, unknown> | undefined;
        if (response && typeof response === 'object') {
            const data = response.data as Record<string, unknown> | undefined;
            if (data && typeof data === 'object' && typeof data.message === 'string') {
                return data.message;
            }
        }
        
        return 'Unknown error occurred';
    }

    public getHeaders(): Record<string, string> {
        if (!this.config.apiKey) {
            throw new Error('API key is required for Cohere');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Accept': 'application/json'
        };
    }
}
