// Content script - runs on every webpage
console.log('Chrome extension content script loaded on:', window.location.href);

// Create a floating popup element
let selectionPopup = null;
let currentSelectedText = '';

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
        { icon: '🔍', text: 'Web Search', action: 'search' },
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
            handleAction(btn.action, currentSelectedText);
        };

        popup.appendChild(button);
    });

    document.body.appendChild(popup);
    return popup;
}

function handleAction(action, text) {
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
    const selectedText = window.getSelection().toString().trim();

    if (selectedText.length > 0) {
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
    }
});