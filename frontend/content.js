// Content script - runs on every webpage
console.log('Chrome extension content script loaded on:', window.location.href);

// Create a floating popup element
let selectionPopup = null;
let currentSelectedText = '';
let selectedTextRange = null; // Store the range for text replacement

function createPopup() {
    const popup = document.createElement('div');
    popup.id = 'text-selection-popup';
    popup.style.cssText = `
    position: absolute;
    background: white;
    color: #333;
    padding: 6px;
    border-radius: 8px;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    display: none;
    gap: 4px;
  `;

    // Create four buttons
    const buttons = [
        { icon: '📝', text: 'Summarize', action: 'summarize' },
        { icon: '🌐', text: 'Translate', action: 'translate' },
        { icon: '🔍', text: 'Web Search', action: 'websearch' }, // Must be 'websearch' not 'search'
        { icon: '💬', text: 'Open Chat', action: 'chat' }
    ];

    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            border: none;
            background: #f5f5f5;
            color: #333;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-family: inherit;
            width: 100%;
            transition: background 0.2s;
            outline: none;
            box-sizing: border-box;
            user-select: none;
            -webkit-user-select: none;
            -webkit-tap-highlight-color: transparent;
        `;
        button.innerHTML = `<span>${btn.icon}</span><span>${btn.text}</span>`;

        button.onmouseover = () => {
            button.style.background = '#e0e0e0';
        };
        button.onmouseout = () => {
            button.style.background = '#f5f5f5';
        };

        button.onmousedown = (e) => {
            e.preventDefault();
            button.style.background = '#d0d0d0';
        };

        button.onmouseup = () => {
            button.style.background = '#e0e0e0';
        };

        button.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Ensure we have the latest selection stored
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                selectedTextRange = selection.getRangeAt(0).cloneRange();
                currentSelectedText = selection.toString().trim();
            }
            handleAction(btn.action, currentSelectedText);
        };

        popup.appendChild(button);
    });

    document.body.appendChild(popup);
    return popup;
}

function handleAction(action, text) {
    // Ensure websearch action is correct (map 'search' to 'websearch' if needed)
    if (action === 'search') {
        action = 'websearch';
    }
    
    console.log(`Action: ${action}, Text: "${text}"`);

    // Send action to background script to open side panel and perform action
    chrome.runtime.sendMessage({
        action: 'openSidePanelWithAction',
        selectedText: text,
        buttonAction: action
    });

    hidePopup();
}

function showPopup(x, y, selectedText) {
    if (!selectionPopup) {
        selectionPopup = createPopup();
    }

    currentSelectedText = selectedText;

    // Position the popup near the selection
    selectionPopup.style.left = `${x}px`;
    selectionPopup.style.top = `${y - 180}px`; // Position above the cursor (adjusted for 4 buttons)
    selectionPopup.style.display = 'flex';
    selectionPopup.style.flexDirection = 'column';
}

function hidePopup() {
    if (selectionPopup) {
        selectionPopup.style.display = 'none';
    }
}

// Listen for text selection
document.addEventListener('mouseup', (event) => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText.length > 0) {
        // Store the selection range for later replacement
        if (selection.rangeCount > 0) {
            selectedTextRange = selection.getRangeAt(0).cloneRange();
        }
        currentSelectedText = selectedText;
        
        // Text is selected, show popup
        showPopup(event.pageX, event.pageY, selectedText);

        // Also send to side panel
        chrome.runtime.sendMessage({
            action: 'textSelected',
            text: selectedText
        }).catch(err => {
            // Side panel might not be open, that's okay
            console.log('Side panel not open');
        });
    } else {
        // No text selected, hide popup
        hidePopup();
    }
});

// Hide popup when clicking elsewhere
document.addEventListener('mousedown', (event) => {
    if (selectionPopup && !selectionPopup.contains(event.target)) {
        // Small delay to allow popup click to register
        setTimeout(() => {
            const selectedText = window.getSelection().toString().trim();
            if (selectedText.length === 0) {
                hidePopup();
            }
        }, 100);
    }
});

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
        sendResponse({ status: 'pong', url: window.location.href });
        return false; // Not async
    }
    
    if (request.action === 'getSelectedText') {
        sendResponse({ text: currentSelectedText });
        return false; // Not async
    }
    
    if (request.action === 'injectContent') {
        // Replace the selected text with new content (for summarize/translate)
        console.log('Inject content requested:', {
            hasSelectedText: !!currentSelectedText,
            hasContent: !!request.content,
            selectedText: currentSelectedText?.substring(0, 50) + '...',
            content: request.content?.substring(0, 50) + '...'
        });
        
        if (currentSelectedText && request.content) {
            const success = replaceSelectedText(request.content);
            sendResponse({ success: success });
        } else {
            console.error('Cannot inject: missing selected text or content', {
                currentSelectedText,
                content: request.content
            });
            sendResponse({ success: false, error: 'No selected text or content provided' });
        }
        return false; // Not async
    }
    
    if (request.action === 'storeSelection') {
        // Store the current selection
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            selectedTextRange = selection.getRangeAt(0).cloneRange();
            currentSelectedText = selection.toString().trim();
            sendResponse({ success: true, text: currentSelectedText });
        } else {
            sendResponse({ success: false });
        }
        return false; // Not async
    }
    
    return false;
});

// Function to replace selected text in the webpage
function replaceSelectedText(newText) {
    console.log('Attempting to replace text:', {
        hasRange: !!selectedTextRange,
        selectedText: currentSelectedText?.substring(0, 50),
        newText: newText?.substring(0, 50)
    });
    
    // First, try using stored range if available (most reliable)
    if (selectedTextRange) {
        try {
            // Validate range - check if containers are still in the DOM
            const startContainer = selectedTextRange.startContainer;
            const endContainer = selectedTextRange.endContainer;
            
            // Check if containers are still connected to the document
            if (startContainer && document.contains(startContainer)) {
                // Try to use the range directly
                selectedTextRange.deleteContents();
                selectedTextRange.insertNode(document.createTextNode(newText));
                
                window.getSelection().removeAllRanges();
                currentSelectedText = '';
                selectedTextRange = null;
                console.log('Successfully replaced using stored range');
                return true;
            } else {
                console.log('Range containers no longer in DOM, trying fallback');
            }
        } catch (e) {
            console.log('Error using stored range, trying fallback method:', e);
        }
    }
    
    // Fallback: Try to find and replace the text in the DOM
    if (!currentSelectedText || currentSelectedText.trim().length === 0) {
        console.warn('No selected text to replace');
        return false;
    }
    
    const searchText = currentSelectedText.trim();
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let node;
    let bestMatch = null;
    
    // Find text nodes containing the selected text
    while (node = walker.nextNode()) {
        const nodeText = node.textContent;
        if (nodeText && nodeText.includes(searchText)) {
            // Find the exact position
            const index = nodeText.indexOf(searchText);
            if (index !== -1) {
                bestMatch = {
                    node: node,
                    index: index,
                    length: searchText.length,
                    fullText: nodeText
                };
                break; // Use first match
            }
        }
    }
    
    if (bestMatch) {
        const { node, index, length, fullText } = bestMatch;
        const beforeText = fullText.substring(0, index);
        const afterText = fullText.substring(index + length);
        
        // Split text node if needed (in case the text spans multiple nodes)
        if (index > 0) {
            const beforeNode = node.splitText(index);
            // Now 'beforeNode' starts at our replacement point
            const afterNode = beforeNode.splitText(length);
            // Replace 'beforeNode' with new content
            beforeNode.textContent = newText;
            console.log('Successfully replaced using DOM search method');
            currentSelectedText = '';
            selectedTextRange = null;
            return true;
        } else if (length === fullText.length) {
            // The entire node is our selected text
            node.textContent = newText;
            console.log('Successfully replaced entire node');
            currentSelectedText = '';
            selectedTextRange = null;
            return true;
        } else {
            // Replace by splitting
            node.splitText(index);
            const replacementNode = node.nextSibling;
            replacementNode.splitText(length);
            replacementNode.textContent = newText;
            console.log('Successfully replaced using split method');
            currentSelectedText = '';
            selectedTextRange = null;
            return true;
        }
    }
    
    console.warn('Could not find text to replace:', searchText);
    return false;
}