# AI Tagger Universe: Easy Tag Generation & Management for Obsidian

> ⚠️ **WARNING:** This is NOT an officially published Obsidian Community Plugin. If you're looking for the official plugin, please visit the original repository at [github.com/niehu2018/obsidian-ai-tagger-universe](https://github.com/niehu2018/obsidian-ai-tagger-universe).

![AI Tagger Universe](https://img.shields.io/badge/Obsidian-AI%20Tagger%20Universe-blue)
![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22ai-tagger-universe%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)
![Obsidian Compatibility](https://img.shields.io/badge/Obsidian-v1.4.0+-blue)

Automatically generate intelligent tags for your Obsidian notes using AI. This plugin analyzes your content and adds relevant tags to your note's frontmatter, helping you organize and discover connections in your knowledge base.

## 🔌 Installation

This plugin needs to be built before installation:

1. Clone this repository to your local machine
2. Make sure you have Node.js installed
3. Open a terminal in the repository folder
4. Run `npm install` to install dependencies
5. Run `npm run build` to build the plugin
6. Create a folder called `ai-tagger-universe` in your Obsidian vault's `.obsidian/plugins/` directory
7. Copy the contents of the `dist/` folder into the `ai-tagger-universe` folder you created
8. Restart Obsidian or reload the app
9. Go to Settings > Community plugins, and enable "AI Tagger Universe"

## ✨ Key Features

### 🤖 Flexible AI Integration
- **Use your preferred AI service**:
  - **Local LLMs**: Ollama, LM Studio, LocalAI, or any OpenAI-compatible endpoint
  - **Cloud Services**: OpenAI, Claude, Gemini, Groq, Grok, Mistral, DeepSeek, Cohere, SiliconFlow, Aliyun, Bedrock, Vertex AI, OpenRouter, and more

### 🏷️ Smart Tagging System
- **Multiple tagging modes**:
  - Generate completely new tags based on content
  - Match against your existing vault tags
  - Use predefined tags from a custom list
  - Hybrid modes combining generation with existing/predefined tags
- **Batch operations** for tagging multiple notes at once
- **Multilingual support** for generating tags in your preferred language

### 📊 Tag Network Visualization
- Interactive graph showing relationships between tags
- Discover connections and patterns in your knowledge base
- Search functionality to find specific tags
- Node size indicates tag frequency

### 🛠️ Advanced Management
- Generate tags from selected text portions
- Batch tag entire folders or your whole vault
- Clear tags while preserving other frontmatter
- Collect and export all tags from your vault

## 🚀 Quick Start

1. **Install the plugin** manually as described above
2. **Configure your AI provider**:
   - Choose between Local LLM or Cloud Service
   - Enter your endpoint URL and API key (if needed)
3. **Select your tagging mode** and adjust tag generation limits
4. **Generate tags** for your current note using the ribbon icon or command palette

## 🔧 Configuration Options

- **AI Provider**: Choose from 15+ local and cloud services
- **Tagging Mode**: Select how tags are generated or matched
- **Tag Limits**: Set maximum numbers for generated/matched tags (0-10)
- **Excluded Paths**: Skip specific folders during batch operations
- **Language**: Generate tags in your preferred language

## 📖 Usage Examples

- **Research Notes**: Automatically categorize research papers and findings
- **Project Management**: Tag project notes for better organization
- **Knowledge Base**: Discover connections between concepts
- **Content Creation**: Generate relevant tags for blog posts or articles
- **Personal Journal**: Track themes and topics in your journal entries

## 🌐 Language Support

Generate tags in multiple languages including English, Chinese, Japanese, German, French, Spanish, Russian, and many more.

## 💖 Support Development

If you find this plugin useful, please consider supporting the original developer at the [official repository](https://github.com/niehu2018/obsidian-ai-tagger-universe).

[MIT License](LICENSE)
