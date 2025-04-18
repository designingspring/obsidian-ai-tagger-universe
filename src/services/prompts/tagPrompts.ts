import { LanguageCode } from '../types';
import { LanguageUtils } from '../../utils/languageUtils';
import { TaggingMode } from './types';
import { TAG_PREDEFINED_RANGE, TAG_GENERATE_RANGE } from '../../utils/constants';

/**
 * System prompt that defines the AI's role
 */
export const SYSTEM_PROMPT = 
    'You are a professional document tag analysis assistant. ' +
    'Please return your response as a plain text string of comma-separated tags. ' +
    'For example: "hello, world, hello world, hello-world"';

/**
 * Language-specific instruction templates for different tagging modes
 */
export const LANGUAGE_INSTRUCTIONS = {
    /* 
    hybrid: (languageName: string) => 
        `IMPORTANT: Generate all new tags in ${languageName} language only.
When generating new tags (not selecting from predefined ones), they must be in ${languageName} only.

`,
    */
    
    generateNew: (languageName: string) =>
        `IMPORTANT: Generate all tags in ${languageName} language only.
Regardless of what language the content is in, all tags must be in ${languageName} only.
First understand the content, then if needed translate concepts to ${languageName}, then generate tags in ${languageName}.

`,
    
    /*
    predefinedTags: () => ''
    */
};

/**
 * Prompt templates for different tagging modes
 */
export const PROMPT_TEMPLATES = {
    /*
    predefinedTags: (maxTags: number, candidateTags: string[], content: string) => 
        `Analyze the following content and select up to ${maxTags} most relevant tags from the provided tag list.
Only use exact matches from the provided tags, do not modify or generate new tags.

Available tags:
${candidateTags.join(', ')}

Content:
${content}

Return only the selected tags as a comma-separated list without # symbol:
hello, world, ,hello-world`,

    hybrid: (maxTags: number, candidateTags: string[], content: string, langInstructions: string) => 
        `${langInstructions}Analyze the following content and:
1. Select relevant tags from the provided tag list (up to ${Math.ceil(maxTags/2)} tags)
2. Generate additional new tags not in the list (up to ${Math.ceil(maxTags/2)} tags)

Available tags to select from:
${candidateTags.join(', ')}

Content:
${content}

Return your response in this JSON format:
{
  "matchedExistingTags": ["tag1", "tag2"], 
  "suggestedTags": ["new-tag1", "new-tag2"]
}
note: don't add "matchedExistingTags" or "suggestedTags" to the tags themselves - only use each once as a json key to provide a valid response strictly following the schema above. 

Do not include the # symbol in tags.`,
    */

    generateNew: (maxTags: number, content: string, langInstructions: string) => 
        `${langInstructions}Analyze the following content and generate up to ${maxTags} relevant tags.
Return tags without the # symbol.

Content:
${content}

Return the tags as a comma-separated list:
hello, world, hello world,hello-world`
};

/**
 * Builds a prompt for tag analysis based on the specified mode
 * @param content - Content to analyze
 * @param candidateTags - Array of candidate tags
 * @param mode - Tagging mode
 * @param maxTags - Maximum number of tags to return
 * @param language - Language for generated tags
 * @returns Formatted prompt string
 */
export function buildTagPrompt(
    content: string, 
    candidateTags: string[], 
    mode: TaggingMode,
    maxTags: number = 5,
    language?: LanguageCode | 'default'
): string {
    let langInstructions = '';

    // Prepare language instructions if needed
    if (language && language !== 'default') {
        const languageName = LanguageUtils.getLanguageDisplayName(language);
        
        switch (mode) {
            /*
            case TaggingMode.Hybrid:
                langInstructions = LANGUAGE_INSTRUCTIONS.hybrid(languageName);
                break;
            */
                
            case TaggingMode.GenerateNew:
                langInstructions = LANGUAGE_INSTRUCTIONS.generateNew(languageName);
                break;
                
            /*
            default:
                langInstructions = LANGUAGE_INSTRUCTIONS.predefinedTags();
            */
        }
    }
    
    switch (mode) {
        /*
        case TaggingMode.PredefinedTags:
            return PROMPT_TEMPLATES.predefinedTags(maxTags, candidateTags, content);

        case TaggingMode.Hybrid:
            return PROMPT_TEMPLATES.hybrid(maxTags, candidateTags, content, langInstructions);
        */

        case TaggingMode.GenerateNew:
            return PROMPT_TEMPLATES.generateNew(maxTags, content, langInstructions);

        default:
            // Fall back to GenerateNew mode for any other mode
            return PROMPT_TEMPLATES.generateNew(maxTags, content, langInstructions);
    }
}

// Re-export for backward compatibility
export { TaggingMode };