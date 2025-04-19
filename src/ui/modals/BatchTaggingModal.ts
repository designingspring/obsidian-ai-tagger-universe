import { App, Modal, ButtonComponent, Notice } from 'obsidian';
import AITaggerPlugin from '../../main';
import { VaultItem } from '../../utils/vaultPathFetcher';

export class BatchTaggingModal extends Modal {
    private folders: string[] = [];
    private filterInput!: HTMLInputElement;
    private pathDropdownContainer!: HTMLElement;
    private searchTerm = '';
    private cachedFolders: VaultItem[] = [];
    private hasLoadedFolders = false;

    private documentClickListener = (event: MouseEvent) => {
        const target = event.target as Node;
        if (this.filterInput && !this.filterInput.parentElement?.contains(target) && 
            !this.pathDropdownContainer.contains(target)) {
            this.pathDropdownContainer.style.display = 'none';
        }
    };

    constructor(
        app: App, 
        private plugin: AITaggerPlugin, 
        private onStartTagging: (folders: string[]) => void
    ) {
        super(app);
        this.folders = plugin.settings.batchTaggingFolder ? [plugin.settings.batchTaggingFolder] : [];
    }

    private loadCachedFolders() {
        // Only load folders if they haven't been loaded yet
        if (!this.hasLoadedFolders) {
            try {
                // Get all folders in the vault
                this.cachedFolders = [];
                this.app.vault.getAllLoadedFiles().forEach(abstractFile => {
                    if ('children' in abstractFile) {  // Check if it's a folder
                        this.cachedFolders.push({
                            path: abstractFile.path,
                            name: abstractFile.name,
                            isFolder: true
                        });
                    }
                });
                this.hasLoadedFolders = true;
            } catch (error) {
                this.cachedFolders = [];
            }
        }
    }

    onOpen() {
        const { contentEl } = this;

        // Load folders when the modal is opened
        this.loadCachedFolders();

        // Set container styles
        contentEl.addClass('batch-tagging-modal');
        contentEl.style.padding = '20px';
        contentEl.style.maxWidth = '500px';
        contentEl.style.margin = '0 auto';
        
        // Set modal title with improved styling
        const titleEl = contentEl.createEl('h2', { 
            text: 'Batch Tagging',
            cls: 'batch-tagging-title'
        });
        titleEl.style.marginTop = '0';
        titleEl.style.marginBottom = '10px';
        titleEl.style.color = 'var(--text-normal)';
        titleEl.style.borderBottom = '1px solid var(--background-modifier-border)';
        titleEl.style.paddingBottom = '10px';
        
        const subtitleEl = contentEl.createEl('p', { 
            text: 'All notes matching the following filters will be tagged:',
            cls: 'batch-tagging-subtitle'
        });
        subtitleEl.style.margin = '10px 0 15px';
        subtitleEl.style.color = 'var(--text-muted)';
        subtitleEl.style.fontSize = '14px';

        // Create selected folder display
        const selectedFoldersContainer = contentEl.createDiv({ cls: 'selected-folders' });
        selectedFoldersContainer.style.marginBottom = '20px';
        selectedFoldersContainer.style.maxHeight = '200px';
        selectedFoldersContainer.style.overflowY = 'auto';
        selectedFoldersContainer.style.padding = '5px';
        selectedFoldersContainer.style.border = '1px solid var(--background-modifier-border)';
        selectedFoldersContainer.style.borderRadius = '4px';
        selectedFoldersContainer.style.backgroundColor = 'var(--background-secondary)';
        
        this.renderSelectedFolders(selectedFoldersContainer);

        // Create filter input container with improved styling
        const filterContainer = contentEl.createDiv({
            cls: 'filter-container'
        });
        filterContainer.style.marginBottom = '20px';

        // Add filter label
        const filterLabel = filterContainer.createEl('div', { 
            text: 'Filter', 
            cls: 'filter-label' 
        });
        filterLabel.style.fontWeight = 'bold';
        filterLabel.style.marginBottom = '8px';
        filterLabel.style.fontSize = '16px';

        // Create input container
        const inputContainer = filterContainer.createDiv({
            cls: 'filter-input-container'
        });
        inputContainer.style.display = 'flex';
        inputContainer.style.position = 'relative';

        // Add input field with improved styling
        this.filterInput = inputContainer.createEl('input', {
            type: 'text',
            placeholder: 'Enter path or "/regex/"',
            cls: 'filter-input',
            value: ''
        });
        this.filterInput.style.flex = '1';
        this.filterInput.style.padding = '8px 12px';
        this.filterInput.style.fontSize = '14px';
        this.filterInput.style.border = '1px solid var(--background-modifier-border)';
        this.filterInput.style.borderRadius = '4px';
        this.filterInput.style.backgroundColor = 'var(--background-primary)';
        
        this.searchTerm = '';  // Start with empty search term

        // Create path dropdown container
        this.pathDropdownContainer = inputContainer.createDiv({
            cls: 'path-dropdown-container'
        });
        
        // Style the dropdown container
        this.pathDropdownContainer.style.position = 'absolute';
        this.pathDropdownContainer.style.top = '100%';
        this.pathDropdownContainer.style.left = '0';
        this.pathDropdownContainer.style.width = '100%';
        this.pathDropdownContainer.style.maxHeight = '200px';
        this.pathDropdownContainer.style.overflowY = 'auto';
        this.pathDropdownContainer.style.backgroundColor = 'var(--background-primary)';
        this.pathDropdownContainer.style.border = '1px solid var(--background-modifier-border)';
        this.pathDropdownContainer.style.borderRadius = '4px';
        this.pathDropdownContainer.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.15)';
        this.pathDropdownContainer.style.zIndex = '1000';
        this.pathDropdownContainer.style.display = 'none';
        
        // Prevent event bubbling to keep dropdown open when clicked
        this.pathDropdownContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Add button with improved styling
        const addButtonContainer = inputContainer.createDiv();
        addButtonContainer.style.marginLeft = '8px';
        
        const addButtonEl = new ButtonComponent(addButtonContainer)
            .setButtonText('Add')
            .onClick(() => {
                const value = this.filterInput.value.trim();
                if (value && !this.folders.includes(value)) {
                    this.folders.push(value);
                    this.renderSelectedFolders(selectedFoldersContainer);
                    this.filterInput.value = '';
                    this.searchTerm = '';
                    this.pathDropdownContainer.style.display = 'none';
                }
            });
        
        // Add class to the button element
        addButtonEl.buttonEl.addClass('batch-tagging-add-button');
        addButtonEl.buttonEl.style.padding = '8px 16px';
        addButtonEl.buttonEl.style.fontSize = '14px';
        addButtonEl.buttonEl.style.fontWeight = 'bold';

        // Set up input events
        this.filterInput.addEventListener('focus', () => {
            // Show dropdown when input gets focus
            this.updateFolderDropdown(this.filterInput.value);
            this.pathDropdownContainer.style.display = 'block';
        });

        this.filterInput.addEventListener('input', () => {
            this.searchTerm = this.filterInput.value;
            this.updateFolderDropdown(this.searchTerm);
            
            // Make sure dropdown is visible when typing
            this.pathDropdownContainer.style.display = 'block';
        });

        this.filterInput.addEventListener('click', (e) => {
            // Prevent document click handler from hiding dropdown
            e.stopPropagation();
            
            // Show dropdown on click in the input
            this.updateFolderDropdown(this.filterInput.value);
            this.pathDropdownContainer.style.display = 'block';
        });

        // Handle clicks outside the dropdown
        document.addEventListener('click', this.documentClickListener);

        // Create spacer element to push buttons to bottom
        const spacerEl = contentEl.createDiv('modal-spacer');
        spacerEl.style.flexGrow = '1';
        spacerEl.style.minHeight = '20px';
        
        // Create button container for Start Tagging/Cancel with improved positioning
        const buttonContainer = contentEl.createDiv('modal-button-container');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.marginTop = '20px';
        buttonContainer.style.padding = '10px 0';
        buttonContainer.style.borderTop = '1px solid var(--background-modifier-border)';
        
        // Left-side buttons container
        const leftButtonContainer = buttonContainer.createDiv('left-buttons');
        
        // Add Clear button
        const clearButtonEl = new ButtonComponent(leftButtonContainer)
            .setButtonText('Clear All')
            .onClick(() => {
                if (this.folders.length > 0 && confirm('Are you sure you want to remove all filters?')) {
                    this.folders = [];
                    this.renderSelectedFolders(selectedFoldersContainer);
                }
            });
        
        // Set appropriate class
        clearButtonEl.buttonEl.addClass('batch-tagging-clear-button');
        clearButtonEl.buttonEl.style.backgroundColor = 'var(--background-secondary)';
        
        // Disable button if no folder selected
        if (this.folders.length === 0) {
            clearButtonEl.buttonEl.setAttribute('disabled', 'true');
            clearButtonEl.buttonEl.addClass('disabled');
        }
        
        // Right-side buttons container
        const rightButtonContainer = buttonContainer.createDiv('right-buttons');
        rightButtonContainer.style.display = 'flex';
        rightButtonContainer.style.gap = '10px';
        
        // Add cancel button
        const cancelButtonEl = new ButtonComponent(rightButtonContainer)
            .setButtonText('Cancel')
            .onClick(() => {
                this.close();
            });
        
        cancelButtonEl.buttonEl.style.minWidth = '80px';
        
        // Add start tagging button
        const startTaggingButtonEl = new ButtonComponent(rightButtonContainer)
            .setButtonText('Start Tagging')
            .setCta()
            .onClick(() => {
                if (this.folders.length === 0) {
                    new Notice('Please add at least one filter first');
                    return;
                }
                
                this.close();
                this.onStartTagging(this.folders);
            });
        
        startTaggingButtonEl.buttonEl.style.minWidth = '120px';
    }

    private updateFolderDropdown(searchTerm: string) {
        this.pathDropdownContainer.empty();
        
        // Return early if no search term
        if (!searchTerm.trim()) {
            this.renderAllFolders();
            return;
        }
        
        // Filter folders based on search term
        const lowerSearchTerm = searchTerm.toLowerCase();
        const matchingFolders = this.cachedFolders.filter(folder => 
            folder.path.toLowerCase().includes(lowerSearchTerm) ||
            folder.name.toLowerCase().includes(lowerSearchTerm)
        );
        
        // Show message when no matches found
        if (matchingFolders.length === 0) {
            const emptyDiv = this.pathDropdownContainer.createDiv('path-dropdown-empty');
            emptyDiv.style.padding = '10px';
            emptyDiv.style.textAlign = 'center';
            emptyDiv.style.color = 'var(--text-muted)';
            emptyDiv.setText('No matching folders found');
            return;
        }
        
        // Sort folders by relevance
        matchingFolders.sort((a, b) => {
            // Folders with name starting with search term come first
            const aStartsWith = a.name.toLowerCase().startsWith(lowerSearchTerm);
            const bStartsWith = b.name.toLowerCase().startsWith(lowerSearchTerm);
            
            if (aStartsWith && !bStartsWith) return -1;
            if (!aStartsWith && bStartsWith) return 1;
            
            // Then sort alphabetically
            return a.path.localeCompare(b.path);
        });
        
        // Show matching folders (limited to avoid performance issues)
        matchingFolders.slice(0, 15).forEach(folder => {
            this.renderFolderItem(folder, lowerSearchTerm);
        });
    }
    
    private renderAllFolders() {
        // Show all top-level folders
        const topLevelFolders = this.cachedFolders.filter(folder => !folder.path.includes('/'));
        
        if (topLevelFolders.length === 0) {
            const emptyDiv = this.pathDropdownContainer.createDiv('path-dropdown-empty');
            emptyDiv.style.padding = '10px';
            emptyDiv.style.textAlign = 'center';
            emptyDiv.style.color = 'var(--text-muted)';
            emptyDiv.setText('No folders found');
            return;
        }
        
        // Sort folders alphabetically
        topLevelFolders.sort((a, b) => a.path.localeCompare(b.path));
        
        // Render each folder
        topLevelFolders.forEach(folder => {
            this.renderFolderItem(folder, '');
        });
    }
    
    private renderFolderItem(folder: VaultItem, searchTerm: string) {
        const itemEl = this.pathDropdownContainer.createDiv('path-dropdown-item');
        itemEl.style.display = 'flex';
        itemEl.style.alignItems = 'center';
        itemEl.style.padding = '8px 12px';
        itemEl.style.cursor = 'pointer';
        itemEl.style.borderBottom = '1px solid var(--background-modifier-border-hover)';
        
        // Hover effect
        itemEl.addEventListener('mouseenter', () => {
            itemEl.style.backgroundColor = 'var(--background-modifier-hover)';
        });
        
        itemEl.addEventListener('mouseleave', () => {
            itemEl.style.backgroundColor = '';
        });
        
        // Folder icon
        const iconEl = itemEl.createSpan('dropdown-item-icon');
        iconEl.innerHTML = `<svg viewBox="0 0 100 100" width="17" height="17" class="folder"><path fill="currentColor" stroke="currentColor" d="M 6,23 H 33 L 47,37 H 94 V 87 H 6 Z"></path></svg>`;
        iconEl.style.marginRight = '8px';
        
        // Folder path display
        const textEl = itemEl.createDiv('dropdown-item-text');
        textEl.style.overflow = 'hidden';
        textEl.style.textOverflow = 'ellipsis';
        textEl.style.whiteSpace = 'nowrap';
        
        // Highlight matching parts if search term provided
        if (searchTerm) {
            const path = folder.path;
            const lowerPath = path.toLowerCase();
            const index = lowerPath.indexOf(searchTerm);
            
            if (index >= 0) {
                // Text before match
                if (index > 0) {
                    textEl.createSpan({ text: path.substring(0, index) });
                }
                
                // Highlight match
                const matchEl = textEl.createSpan({
                    text: path.substring(index, index + searchTerm.length)
                });
                matchEl.style.backgroundColor = 'var(--text-highlight-bg)';
                matchEl.style.color = 'var(--text-normal)';
                matchEl.style.borderRadius = '2px';
                
                // Text after match
                if (index + searchTerm.length < path.length) {
                    textEl.createSpan({ 
                        text: path.substring(index + searchTerm.length) 
                    });
                }
            } else {
                textEl.setText(path);
            }
        } else {
            textEl.setText(folder.path);
        }
        
        // Click handler to select folder
        itemEl.addEventListener('click', () => {
            this.filterInput.value = folder.path;
            this.pathDropdownContainer.style.display = 'none';
        });
    }

    private renderSelectedFolders(container: HTMLElement) {
        container.empty();
        
        if (this.folders.length === 0) {
            const emptyEl = container.createDiv('selected-folder-empty');
            emptyEl.style.padding = '5px';
            emptyEl.style.color = 'var(--text-muted)';
            emptyEl.style.fontStyle = 'italic';
            emptyEl.style.textAlign = 'center';
            emptyEl.setText('No filters selected');
            return;
        }
        
        // Add each folder as a separate item
        this.folders.forEach((folder, index) => {
            const folderEl = container.createDiv('selected-folder-item');
            folderEl.style.display = 'flex';
            folderEl.style.alignItems = 'center';
            folderEl.style.justifyContent = 'space-between';
            folderEl.style.padding = '5px';
            folderEl.style.marginBottom = index < this.folders.length - 1 ? '5px' : '0';
            folderEl.style.borderBottom = index < this.folders.length - 1 ? '1px solid var(--background-modifier-border)' : '';
            
            // Left side with folder info
            const infoEl = folderEl.createDiv('folder-info');
            infoEl.style.display = 'flex';
            infoEl.style.alignItems = 'center';
            infoEl.style.flex = '1';
            infoEl.style.overflow = 'hidden';
            
            // Icon (folder or regex)
            const iconEl = infoEl.createSpan('folder-icon');
            const isRegex = folder.startsWith('/') && folder.endsWith('/') && folder.length > 2;
            
            if (isRegex) {
                iconEl.innerHTML = `<svg viewBox="0 0 100 100" width="17" height="17" class="regex"><path fill="currentColor" stroke="currentColor" d="M50 20 L70 50 L50 80 L30 50 Z"></path></svg>`;
            } else {
                iconEl.innerHTML = `<svg viewBox="0 0 100 100" width="17" height="17" class="folder"><path fill="currentColor" stroke="currentColor" d="M 6,23 H 33 L 47,37 H 94 V 87 H 6 Z"></path></svg>`;
            }
            
            iconEl.style.marginRight = '8px';
            
            // Path text
            const pathEl = infoEl.createSpan('folder-path');
            pathEl.setText(folder);
            pathEl.style.overflow = 'hidden';
            pathEl.style.textOverflow = 'ellipsis';
            pathEl.style.whiteSpace = 'nowrap';
            
            // Remove button
            const removeEl = folderEl.createDiv('folder-remove');
            const removeButton = new ButtonComponent(removeEl)
                .setIcon('x')
                .setTooltip('Remove')
                .onClick(() => {
                    this.folders.splice(index, 1);
                    this.renderSelectedFolders(container);
                });
            
            removeButton.buttonEl.style.padding = '0';
            removeButton.buttonEl.style.color = 'var(--text-muted)';
        });
    }

    onClose() {
        document.removeEventListener('click', this.documentClickListener);
    }
} 