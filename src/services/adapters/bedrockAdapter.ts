import { BaseAdapter } from './baseAdapter';
import { BaseResponse, RequestBody, AdapterConfig } from './types';
import * as endpoints from './cloudEndpoints.json';

// Define interface for Bedrock error response structure
interface BedrockErrorResponse {
    errorMessage?: string;
    response?: {
        data?: {
            errorMessage?: string;
        };
    };
    message?: string;
}

export class BedrockAdapter extends BaseAdapter {
    private readonly defaultConfig = {
        max_tokens: 1024,
        temperature: 0.7
    };

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint || endpoints.bedrock,
            modelName: config.modelName || 'anthropic.claude-3-haiku-20240307-v1:0'
        });
        this.provider = {
            name: 'bedrock',
            requestFormat: {
                url: '/model/invoke',
                headers: {},
                body: {
                    model: this.modelName
                }
            },
            responseFormat: {
                path: ['completion'],
                errorPath: ['errorMessage']
            }
        };
    }

    public formatRequest(prompt: string): RequestBody {
        const modelName = this.config.modelName || '';
        const baseRequest = super.formatRequest(prompt);
        
        // 根据模型类型提供不同的请求格式
        if (modelName.includes('claude')) {
            return {
                ...baseRequest,
                prompt: `\n\nHuman: ${prompt}\n\nAssistant: `,
                ...this.defaultConfig,
                anthropic_version: '2023-01-01'
            };
        } else if (modelName.includes('titan')) {
            return {
                ...baseRequest,
                inputText: prompt,
                textGenerationConfig: {
                    maxTokenCount: this.defaultConfig.max_tokens,
                    temperature: this.defaultConfig.temperature,
                    stopSequences: []
                }
            };
        }
        
        return {
            ...baseRequest,
            prompt,
            ...this.defaultConfig
        };
    }

    protected override _parseResponseInternal(response: unknown): BaseResponse {
        try {
            const bedrockResponse = response as Record<string, unknown>;
            // Bedrock responses vary by model, so we need to handle different formats
            let content = '';
            
            // Claude model response format
            if (bedrockResponse.completion) {
                content = bedrockResponse.completion as string;
            }
            // Titan model response format
            else if (bedrockResponse.results && Array.isArray(bedrockResponse.results) && bedrockResponse.results.length > 0) {
                content = bedrockResponse.results[0].outputText as string;
            }
            // LLama 2 response format
            else if (bedrockResponse.generation) {
                content = bedrockResponse.generation as string;
            }
            // Unknown format - try to use the response object directly
            else {
                // Try to extract content from known paths
                let contentObj: unknown = bedrockResponse;
                for (const key of this.provider.responseFormat.path) {
                    if (contentObj && typeof contentObj === 'object') {
                        contentObj = (contentObj as Record<string, unknown>)[key as string];
                    } else {
                        break;
                    }
                }
                
                // At this point, contentObj should contain the content, if it exists
                if (typeof contentObj === 'string') {
                    content = contentObj;
                } else {
                    content = JSON.stringify(contentObj);
                }
            }
            
            if (!content) {
                throw new Error('Invalid response format: unable to extract content');
            }
            
            // Try to extract JSON from the content
            try {
                const jsonContent = this.extractJsonFromContent(content);
                
                // Check if both required arrays exist
                if (jsonContent && (Array.isArray(jsonContent.matchedTags) || Array.isArray(jsonContent.newTags))) {
                    return {
                        text: content,
                        matchedExistingTags: Array.isArray(jsonContent.matchedTags) ? jsonContent.matchedTags : [],
                        suggestedTags: Array.isArray(jsonContent.newTags) ? jsonContent.newTags : []
                    };
                }
                
                // Try alternative field names
                const matchedTags = Array.isArray(jsonContent.matchedExistingTags) ? 
                    jsonContent.matchedExistingTags : 
                    [];
                    
                const newTags = Array.isArray(jsonContent.suggestedTags) ? 
                    jsonContent.suggestedTags : 
                    Array.isArray(jsonContent.tags) ? 
                        jsonContent.tags : 
                        [];
                
                return {
                    text: content,
                    matchedExistingTags: matchedTags,
                    suggestedTags: newTags
                };
            } catch (jsonError) {
                // If we failed to extract JSON, return empty arrays
                return {
                    text: content,
                    matchedExistingTags: [],
                    suggestedTags: []
                };
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse Bedrock response: ${message}`);
        }
    }

    public validateConfig(): string | null {
        if (!this.config.apiKey) {
            return 'API key is required for AWS Bedrock';
        }
        if (!this.config.endpoint) {
            return 'Endpoint is required for AWS Bedrock';
        }
        if (!this.config.modelName) {
            return 'Model name is required for AWS Bedrock';
        }
        return null;
    }

    public extractError(error: Record<string, unknown> | Error): string {
        if (error instanceof Error) {
            return error.message;
        }
        
        const errorObj = error as BedrockErrorResponse;
        return errorObj.errorMessage ||
            errorObj.response?.data?.errorMessage ||
            errorObj.message ||
            'Unknown error occurred';
    }

    public getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };
    }
}
