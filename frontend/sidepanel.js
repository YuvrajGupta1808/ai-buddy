// Side panel script
let chatHistory = [];
let currentAction = null; // Track which action button was clicked

// Get references to DOM elements
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const loadingSection = document.getElementById('loadingSection');

const summarizeBtn = document.getElementById('summarizeBtn');
const translateBtn = document.getElementById('translateBtn');
const searchBtn = document.getElementById('searchBtn');

console.log('AI Buddy loaded');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'textSelected') {
        // Store the selected text but don't display it
        // Just enable action buttons to use it
        currentSelectedText = request.text;
        sendResponse({ received: true });
    }

    if (request.action === 'performAction') {
        currentSelectedText = request.selectedText;
        currentAction = request.buttonAction;
        
        // Perform the requested action directly
        handleQuickAction(request.buttonAction, request.selectedText);
        
        sendResponse({ received: true });
    }
});

let currentSelectedText = '';

// Get selected text from the active tab
async function getSelectedText() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
        return response?.text || '';
    } catch (error) {
        console.log('No selected text:', error);
        return '';
    }
}

function showLoading() {
    loadingSection.classList.remove('hidden');
    sendChatBtn.disabled = true;
    chatInput.disabled = true;
}

function hideLoading() {
    loadingSection.classList.add('hidden');
    sendChatBtn.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
}

// Send request to backend
async function sendToBackend(text, action) {
    const backendUrl = 'https://untangental-odilia-nonresponsively.ngrok-free.dev/run';

    console.log('Sending request to backend...');
    console.log('Action:', action);
    console.log('Text:', text);

    try {
        // Ensure text is not empty
        if (!text || text.trim() === '') {
            throw new Error('Text cannot be empty');
        }

        const requestBody = {
            task: action,
            text: text.trim()
        };

        console.log('Request body:', requestBody);

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true' // For ngrok
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            // Try to get error details from response
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.error || errorData.message) {
                    errorMessage = errorData.error || errorData.message || errorMessage;
                }
            } catch (e) {
                // If response is not JSON, use status text
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Response data:', data);
        return {
            success: true,
            data: data
        };

    } catch (error) {
        console.error('Error sending to backend:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Quick action handlers
async function handleQuickAction(action, text = null) {
    let textToUse = '';
    
    // Priority: explicitly provided text > selected text > chat input text
    if (text) {
        textToUse = text;
    } else if (currentSelectedText) {
        textToUse = currentSelectedText;
    } else if (chatInput.value.trim()) {
        textToUse = chatInput.value.trim();
        // Clear input since we're using it for the tool
        chatInput.value = '';
        resetTextareaHeight();
    }
    
    if (!textToUse) {
        // If no text at all, ask user to provide some
        const actionName = action === 'websearch' ? 'WebSearch' : 
                          action === 'summarize' ? 'Summarize' :
                          action === 'translate' ? 'Translate' : 'this action';
        addChatMessage('assistant', `Please select some text on the page or type a query in the input field to ${actionName.toLowerCase()}.`);
        
        // Focus on input for better UX
        chatInput.focus();
        return;
    }

    // Remove welcome message if present
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }

    // Add user message showing only the action, not the text
    const actionNames = {
        'summarize': 'Summarize',
        'translate': 'Translate',
        'websearch': 'WebSearch',
        'chat': 'Chat'
    };
    
    addChatMessage('user', `[${actionNames[action] || action}]`);

    // Show loading
    showLoading();

    // Perform the action
    const response = await sendToBackend(textToUse, action);
    
    hideLoading();

    if (response.success) {
        // Handle response format - could be response.data.output or response.data directly
        const output = response.data.output || response.data;
        const tool = output.task || response.data.task || action;
        const result = output.result || response.data.result || response.data;
        const message = output.message || response.data.message;
        
        // For summarize and translate: inject result into webpage, show only task and message in side panel
        if ((action === 'summarize' || action === 'translate') && result) {
            // Inject the result into the webpage
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.id) {
                    const injectResponse = await chrome.tabs.sendMessage(tab.id, {
                        action: 'injectContent',
                        content: result
                    });
                    
                    if (injectResponse && injectResponse.success) {
                        console.log('Content injected successfully');
                    } else {
                        console.error('Failed to inject content:', injectResponse?.error || 'Unknown error');
                    }
                } else {
                    console.error('No active tab found');
                }
            } catch (err) {
                console.error('Error injecting content:', err);
                // Still show success message even if injection fails
            }
            
            // Show only the task and message in side panel (matching the output format)
            const taskName = tool || action;
            const displayMessage = message || `${actionNames[action]} completed successfully!`;
            addChatMessage('assistant', `Task: ${taskName}\n\n${displayMessage}`);
        } else {
            // For other actions (websearch, chat), show the full result
            let formattedResult = result;
            if (tool !== 'chat') {
                formattedResult = `**${actionNames[action] || action} Result:**\n\n${result}`;
            }
            addChatMessage('assistant', formattedResult);
        }
    } else {
        addChatMessage('assistant', `❌ Error: ${response.error}\n\nPlease try again.`);
    }
}

function addChatMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = role === 'user' ? '👤' : '🤖';

    const messageContent = document.createElement('div');
    messageContent.className = 'chat-message-wrapper';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'chat-message-header';
    headerDiv.textContent = role === 'user' ? 'You' : 'AI Buddy';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'chat-message-content';
    
    // Format markdown-like content
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    content = content.replace(/\n/g, '<br>');
    contentDiv.innerHTML = content;

    messageContent.appendChild(headerDiv);
    messageContent.appendChild(contentDiv);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    
    chatMessages.appendChild(messageDiv);

    // Store in history
    chatHistory.push({ role, content: content.replace(/<[^>]*>/g, '') });

    // Scroll to bottom
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
}

async function sendMessage() {
    const message = chatInput.value.trim();

    if (!message) {
        return;
    }

    // Regular chat - only use typed text, ignore selected text
    // Selected text remains available for tool buttons if needed

    // Remove welcome message if present
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }

    // Add user message to chat
    addChatMessage('user', message);

    // Clear input
    chatInput.value = '';
    resetTextareaHeight();

    // Show loading
    showLoading();

    // Get AI response
    const response = await sendToBackend(message, 'chat');
    
    hideLoading();

    if (response.success) {
        const tool = response.data.task || 'chat';
        const result = response.data.result || response.data;
        addChatMessage('assistant', result);
    } else {
        addChatMessage('assistant', `❌ Error: ${response.error}\n\nPlease try again.`);
    }
}

function resetTextareaHeight() {
    chatInput.style.height = 'auto';
    chatInput.rows = 1;
}

function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    const newHeight = Math.min(chatInput.scrollHeight, 120);
    chatInput.style.height = newHeight + 'px';
}

// Button handlers
summarizeBtn.addEventListener('click', () => handleQuickAction('summarize'));
translateBtn.addEventListener('click', () => handleQuickAction('translate'));
searchBtn.addEventListener('click', () => handleQuickAction('websearch'));

// Chat input handlers
sendChatBtn.addEventListener('click', sendMessage);

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

chatInput.addEventListener('input', autoResizeTextarea);

// Focus input on load
setTimeout(() => {
    chatInput.focus();
}, 100);

