import { LanguageCode } from '../types';
import { LanguageUtils } from '../../utils/languageUtils';
import { TaggingMode } from './types';
import { TAG_PREDEFINED_RANGE, TAG_GENERATE_RANGE } from '../../utils/constants';

/**
 * System prompt that defines the AI's role
 */
export const TAG_SYSTEM_PROMPT = 
    'You are an expert tagging assistant. Your task is to generate tags for a given document. The tags you create must adhere to the following criteria:\n\n' +
    '1. **Relevant**: Each tag should accurately reflect the content or purpose of the document. Ask yourself, "What is this document about?"\n' +
    '2. **Specific (but not too narrow)**: Avoid overly broad tags like "misc" or "stuff," and do not be so detailed that a tag only applies in one rare case. Choose words that are likely to be reused.\n' +
    '3. **Consistent**: Use a uniform style (e.g., lowercase letters, hyphenation if necessary) so that tags follow an agreed-upon vocabulary.\n' +
    '4. **Searchable**: Select tags that contain keywords a person might naturally use when searching for this document.\n' +
    '5. **Multi-dimensional (when needed)**: Include tags that can denote type, topic, status, audience, or date when relevant (e.g., "report," "finance," "2024").\n' +
    '6. **Avoid Redundancy**: Do not include tags that duplicate metadata already provided elsewhere unless they enhance searchability.' +
    '7. **Return only tags**: Return your response ONLY as a comma-separated list of tags. Do not include the # symbol. For example: programming, javascript, web-development, tutorial' +
    '8. **Avoid dates**: Do not return any tags that include dates. For example: 2024, June, 27th etc.';

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
        // `${langInstructions}Analyze the following content and generate up to ${maxTags} relevant tags.

        `Below is the document content.
Please carefully review the content and generate up to ${maxTags} appropriate tags.
You may return fewer than ${maxTags} tags if the content doesn't require that many.

Content:
${content}`

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