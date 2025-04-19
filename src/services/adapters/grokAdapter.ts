import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';

export class GrokAdapter extends BaseAdapter {
    private readonly defaultConfig = {
        max_tokens: 2048,
        temperature: 0.7
    };

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.grok
        });
        this.provider = {
            name: 'grok',
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
            const grokResponse = response as Record<string, unknown>;
            const candidates = grokResponse.candidates as Array<Record<string, unknown>> | undefined;
            
            if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
                throw new Error('Invalid response format: missing candidates array');
            }
            
            const firstCandidate = candidates[0];
            if (!firstCandidate || typeof firstCandidate !== 'object') {
                throw new Error('Invalid response format: first candidate is not an object');
            }
            
            const content = firstCandidate.content as Record<string, unknown> | undefined;
            if (!content || typeof content !== 'object') {
                throw new Error('Invalid response format: missing content object');
            }
            
            const parts = Array.isArray(content.parts) ? content.parts : undefined;
            if (!parts || parts.length === 0) {
                throw new Error('Invalid response format: missing parts array');
            }
            
            const firstPart = parts[0] as Record<string, unknown> | undefined;
            if (!firstPart || typeof firstPart !== 'object') {
                throw new Error('Invalid response format: first part is not an object');
            }
            
            const text = firstPart.text as string | undefined;
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid response format: missing text content');
            }
            
            // Process the content to extract tags
            try {
                const jsonContent = this.extractJsonFromContent(text);
                
                return {
                    text: text,
                    matchedExistingTags: Array.isArray(jsonContent.matchedTags) ? jsonContent.matchedTags : [],
                    suggestedTags: Array.isArray(jsonContent.newTags) ? jsonContent.newTags : []
                };
            } catch (jsonError) {
                // If JSON extraction fails, return empty arrays
                return {
                    text: text,
                    matchedExistingTags: [],
                    suggestedTags: []
                };
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse Grok response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for Grok';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for Grok';
        }
        if (!this.config.modelName) {
            return 'Model name is required for Grok';
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
            throw new Error('API key is required for Grok');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };
    }
}
