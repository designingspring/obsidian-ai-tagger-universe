import { BaseLLMService } from "../baseService";
import { AdapterConfig, RequestBody, BaseResponse } from "./types";
import { TAG_SYSTEM_PROMPT } from "../prompts/tagPrompts";
import { TaggingMode } from "../prompts/types";
import { App } from "obsidian";
import { ConnectionTestError, ConnectionTestResult, LanguageCode, LLMResponse } from "../types";

export interface LLMServiceProvider {
    name: string;
    requestFormat: {
        url?: string;
        headers?: Record<string, string>;
        body?: Record<string, unknown>;
        contentPath?: (string | number)[];
    };
    responseFormat: {
        path: (string | number)[];
        errorPath?: (string | number)[];
        contentPath?: (string | number)[];
    };
}

export abstract class BaseAdapter extends BaseLLMService {
    protected config: AdapterConfig;
    protected provider: LLMServiceProvider;

    /**
     * Formats a request for the cloud service
     * Handles provider-specific request formats
     * @param prompt - The prompt to send to the LLM
     * @param language - Optional language code
     * @returns Formatted request body
     */
    public formatRequest(prompt: string, language?: string): RequestBody {
        if (this.provider?.requestFormat?.body) {
            // For providers that need specific request format
            return {
                ...this.provider.requestFormat.body,
                messages: [
                    { role: 'system', content: TAG_SYSTEM_PROMPT },
                    { role: 'user', content: prompt }
                ]
            };
        }
        
        // If no provider-specific format, use the parent class implementation
        return super.formatRequest(prompt, language);
    }

    /**
     * Internal method to parse response from cloud provider
     * @param response - Response from the provider
     * @returns BaseResponse with processed tags
     */
    protected _parseResponse(response: unknown): BaseResponse {
        if (!this.provider?.responseFormat?.path) {
            throw new Error('Provider response format not configured');
        }

        try {
            const responseObj = response as Record<string, unknown>;
            
            if (responseObj.error && this.provider.responseFormat.errorPath) {
                let errorMsg: unknown = responseObj;
                for (const key of this.provider.responseFormat.errorPath) {
                    if (typeof errorMsg === 'object' && errorMsg !== null) {
                        errorMsg = (errorMsg as Record<string | number, unknown>)[key];
                    } else {
                        break;
                    }
                }
                throw new Error(typeof errorMsg === 'string' ? errorMsg : 'Unknown error');
            }

            let result: unknown = responseObj;
            for (const key of this.provider.responseFormat.path) {
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid response structure');
                }
                result = (result as Record<string | number, unknown>)[key];
            }

            // Extract JSON from content if needed
            if (typeof result === 'string') {
                const stringResult = result; // Create a variable that TypeScript knows is a string
                try {
                    result = this.extractJsonFromContent(stringResult);
                } catch (error) {
                    //console.error('Failed to parse JSON from response:', error);
                    // If JSON parsing fails, try to extract tags directly
                    const tags = this.extractTagsFromText(stringResult);
                    result = {
                        matchedTags: [],
                        newTags: tags
                    };
                }
            }

            // Cast result to a record with string arrays
            const resultObj = result as Record<string, unknown>;
            
            // Ensure both matchedTags and newTags are arrays of strings
            if (resultObj.matchedTags && !Array.isArray(resultObj.matchedTags)) {
                resultObj.matchedTags = [];
            }
            if (resultObj.newTags && !Array.isArray(resultObj.newTags)) {
                resultObj.newTags = [];
            }

            // Convert matched tags to strings and trim
            const matchedTags = Array.isArray(resultObj.matchedTags) 
                ? (resultObj.matchedTags as unknown[]).map(tag => String(tag).trim())
                : [];
                
            // Convert new tags to strings and trim
            const newTags = Array.isArray(resultObj.newTags)
                ? (resultObj.newTags as unknown[]).map(tag => String(tag).trim())
                : [];

            return {
                text: typeof resultObj.text === 'string' ? resultObj.text : '',
                matchedExistingTags: matchedTags,
                suggestedTags: newTags
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse response: ${message}`);
        }
    }

    /**
     * Override of BaseLLMService parseResponse
     * This maintains compatibility with the base class
     */
    protected override parseResponse(response: string, mode: TaggingMode, maxTags: number): LLMResponse {
        try {
            // First parse the response string to JSON to get an object
            const jsonResponse = JSON.parse(response) as Record<string, unknown>;
            // Then use our internal response parser
            const baseResponse = this._parseResponseInternal(jsonResponse);
            
            // Convert BaseResponse to LLMResponse
            return {
                matchedExistingTags: baseResponse.matchedExistingTags || [],
                suggestedTags: baseResponse.suggestedTags || [],
                tags: [...(baseResponse.matchedExistingTags || []), ...(baseResponse.suggestedTags || [])]
            };
        } catch (error) {
            // Fallback - use base class implementation
            return super.parseResponse(response, mode, maxTags);
        }
    }

    /**
     * Internal method for parsing response
     * This should be overridden by child classes that need custom parsing logic
     * @param response - The response object to parse
     * @returns BaseResponse with processed tags
     */
    protected _parseResponseInternal(response: unknown): BaseResponse {
        if (!this.provider?.responseFormat?.path) {
            throw new Error('Provider response format not configured');
        }

        try {
            const responseObj = response as Record<string, unknown>;
            
            if (responseObj.error && this.provider.responseFormat.errorPath) {
                let errorMsg: unknown = responseObj;
                for (const key of this.provider.responseFormat.errorPath) {
                    if (typeof errorMsg === 'object' && errorMsg !== null) {
                        errorMsg = (errorMsg as Record<string | number, unknown>)[key];
                    } else {
                        break;
                    }
                }
                throw new Error(typeof errorMsg === 'string' ? errorMsg : 'Unknown error');
            }

            let result: unknown = responseObj;
            for (const key of this.provider.responseFormat.path) {
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid response structure');
                }
                result = (result as Record<string | number, unknown>)[key];
            }

            // Extract JSON from content if needed
            if (typeof result === 'string') {
                const stringResult = result; // Create a variable that TypeScript knows is a string
                try {
                    result = this.extractJsonFromContent(stringResult);
                } catch (error) {
                    //console.error('Failed to parse JSON from response:', error);
                    // If JSON parsing fails, try to extract tags directly
                    const tags = this.extractTagsFromText(stringResult);
                    result = {
                        matchedTags: [],
                        newTags: tags
                    };
                }
            }

            // Cast result to a record with string arrays
            const resultObj = result as Record<string, unknown>;
            
            // Ensure both matchedTags and newTags are arrays of strings
            if (resultObj.matchedTags && !Array.isArray(resultObj.matchedTags)) {
                resultObj.matchedTags = [];
            }
            if (resultObj.newTags && !Array.isArray(resultObj.newTags)) {
                resultObj.newTags = [];
            }

            // Convert matched tags to strings and trim
            const matchedTags = Array.isArray(resultObj.matchedTags) 
                ? (resultObj.matchedTags as unknown[]).map(tag => String(tag).trim())
                : [];
                
            // Convert new tags to strings and trim
            const newTags = Array.isArray(resultObj.newTags)
                ? (resultObj.newTags as unknown[]).map(tag => String(tag).trim())
                : [];

            return {
                text: typeof resultObj.text === 'string' ? resultObj.text : '',
                matchedExistingTags: matchedTags,
                suggestedTags: newTags
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse response: ${message}`);
        }
    }

    private extractTagsFromText(text: string): string[] {
        // Look for hashtags in the response
        const hashtagRegex = /#[\p{L}\p{N}-]+/gu;
        const hashtags = text.match(hashtagRegex) || [];
        
        if (hashtags.length > 0) {
            return hashtags;
        }
        
        // If no hashtags found, look for potential tags in quotes or lists
        const potentialTagsRegex = /["']([a-zA-Z0-9-]+)["']|\s+[-*]\s+([a-zA-Z0-9-]+)/g;
        const potentialTags: string[] = [];
        let match;
        
        while ((match = potentialTagsRegex.exec(text)) !== null) {
            const tag = match[1] || match[2];
            if (tag) {
                potentialTags.push(`#${tag}`);
            }
        }
        
        return potentialTags;
    }

    public validateConfig(): string | null {
        return super.validateConfig();
    }

    constructor(config: AdapterConfig) {
        super({
            ...config,
            endpoint: config.endpoint ?? "",
            modelName: config.modelName ?? ""
        }, null as unknown as App);  // Pass null for app as it's not needed in the adapter
        this.config = config;
    }

    /**
     * Implementation of the base analyzeTags method
     */
    async analyzeTags(
        content: string, 
        candidateTags: string[] = [], 
        mode: TaggingMode = TaggingMode.GenerateNew,
        maxTags = 10,
        language?: LanguageCode
    ): Promise<LLMResponse> {
        // Build the prompt using the proper parameters
        const prompt = this.buildPrompt(content, candidateTags, mode, maxTags, language);
        
        // We'll use sendRequest which returns a string that parseResponse can handle
        const response = await this.sendRequest(prompt);
        
        // Use the parseResponse method which is compatible with BaseLLMService
        return this.parseResponse(response as string, mode, maxTags);
    }

    async testConnection(): Promise<{ result: ConnectionTestResult; error?: ConnectionTestError }> {
        try {
            await this.makeRequest('test');
            return { 
                result: ConnectionTestResult.Success 
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { 
                result: ConnectionTestResult.Failed,
                error: {
                    type: "unknown",
                    message: message
                } 
            };
        }
    }

    protected async makeRequest(prompt: string): Promise<unknown> {
        const headers = this.getHeaders();
        const body = this.formatRequest(prompt, this.config.language);
        
        const response = await fetch(this.getEndpoint(), {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`Request failed: ${response.statusText}`);
        }

        return await response.json();
    }

    getEndpoint(): string {
        return this.config.endpoint ?? "";
    }

    getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json'
        };
    }

    getParams(): Record<string, string> {
        return {};
    }

    getClient(): {
        baseURL: string;
        headers: Record<string, string>;
        params: Record<string, string>;
    } {
        const clientConfig = {
            baseURL: this.getEndpoint(),
            headers: this.getHeaders(),
            params: this.getParams()
        };
    
        // Just return config, let the consumer create the client as needed
        return clientConfig;
    }

    protected extractJsonFromContent(content: string): Record<string, unknown> {
        try {
            const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }
            const standaloneJson = content.match(/\{[\s\S]*\}/);
            if (standaloneJson) {
                return JSON.parse(standaloneJson[0]);
            }
            throw new Error('No JSON found in response');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to parse JSON: ${message}`);
        }
    }

    /**
     * Extracts the main content from a cloud provider response
     * @param response The response object from the cloud provider
     * @returns The extracted content as a string
     */
    public parseResponseContent(response: unknown): string {
        try {
            const responseObj = response as Record<string, unknown>;
            
            if (!this.provider?.responseFormat?.contentPath) {
                // Default OpenAI-like format
                const choices = responseObj.choices as Array<Record<string, unknown>> | undefined;
                const firstChoice = choices?.[0] as Record<string, unknown> | undefined;
                const message = firstChoice?.message as Record<string, unknown> | undefined;
                return message?.content as string || '';
            }

            // Follow provider-specific content path
            let content: unknown = responseObj;
            for (const key of this.provider.responseFormat.contentPath) {
                if (!content || typeof content !== 'object') {
                    throw new Error('Invalid response structure');
                }
                content = (content as Record<string | number, unknown>)[key];
            }
            
            return typeof content === 'string' ? content : JSON.stringify(content);
        } catch (error) {
            //console.error('Failed to parse response content:', error);
            return '';
        }
    }

    /**
     * Sends a request to the LLM service
     * Abstract method implementation required by BaseLLMService
     * @param prompt - The prompt to send
     * @returns Promise resolving to the response
     */
    protected async sendRequest(prompt: string): Promise<string> {
        const response = await this.makeRequest(prompt);
        return this.parseResponseContent(response);
    }
}
