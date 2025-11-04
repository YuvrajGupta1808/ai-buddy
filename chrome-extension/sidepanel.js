// Side panel script
let currentSelectedText = '';
let chatHistory = [];
let isChatMode = false;

// Get references to DOM elements
const selectedTextSection = document.getElementById('selectedTextSection');
const selectedTextDisplay = document.getElementById('selectedText');
const loadingSection = document.getElementById('loadingSection');
const resultSection = document.getElementById('resultSection');
const resultDisplay = document.getElementById('result');
const emptyState = document.getElementById('emptyState');
const chatSection = document.getElementById('chatSection');
const chatMessages = document.getElementById('chatMessages');
const chatInputContainer = document.getElementById('chatInputContainer');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

const summarizeBtn = document.getElementById('summarizeBtn');
const translateBtn = document.getElementById('translateBtn');
const searchBtn = document.getElementById('searchBtn');
const chatBtn = document.getElementById('chatBtn');

const actionButtons = [summarizeBtn, translateBtn, searchBtn, chatBtn];

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'textSelected') {
        currentSelectedText = request.text;
        showSelectedText(request.text);
        sendResponse({ received: true });
    }

    if (request.action === 'performAction') {
        currentSelectedText = request.selectedText;
        showSelectedText(request.selectedText);

        // Perform the requested action
        switch (request.buttonAction) {
            case 'summarize':
                handleSummarize();
                break;
            case 'translate':
                handleTranslate();
                break;
            case 'search':
                handleSearch();
                break;
            case 'chat':
                handleChat();
                break;
        }

        sendResponse({ received: true });
    }
});

function showSelectedText(text) {
    emptyState.classList.add('hidden');
    selectedTextSection.classList.remove('hidden');
    selectedTextDisplay.textContent = text;

    // Only hide chat if not in chat mode
    if (!isChatMode) {
        resultSection.classList.add('hidden');
        chatSection.classList.add('hidden');
        chatInputContainer.classList.add('hidden');
    }

    loadingSection.classList.add('hidden');
    enableButtons();
}

function showLoading() {
    loadingSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
    disableButtons();
}

function showResult(title, content) {
    loadingSection.classList.add('hidden');
    resultSection.classList.remove('hidden');
    resultDisplay.innerHTML = `<strong>${title}</strong><br><br>${content}`;
    enableButtons();
}

function disableButtons() {
    actionButtons.forEach(btn => btn.disabled = true);
}

function enableButtons() {
    actionButtons.forEach(btn => btn.disabled = false);
}

// Send request to backend
async function sendToBackend(text, action) {
    const backendUrl = 'http://localhost:5000/run';

    console.log('Sending request to backend...');
    console.log('Action:', action);
    console.log('Text:', text);

    try {
        // Request body with task and text fields
        const requestBody = {
            task: action,
            text: text
        };

        console.log('Request body:', requestBody);

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

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

// Action handlers
async function handleSummarize() {
    showLoading();
    const response = await sendToBackend(currentSelectedText, 'summarize');

    if (response.success) {
        showResult('Summary', response.data);
    } else {
        showResult('Error', `Failed to get summary: ${response.error}`);
    }
}

async function handleTranslate() {
    showLoading();
    const response = await sendToBackend(currentSelectedText, 'translate');

    if (response.success) {
        showResult('Translation', response.data);
    } else {
        showResult('Error', `Failed to get translation: ${response.error}`);
    }
}

async function handleSearch() {
    showLoading();
    const response = await sendToBackend(currentSelectedText, 'websearch');

    if (response.success) {
        showResult('Web Search', response.data);
    } else {
        showResult('Error', `Failed to perform web search: ${response.error}`);
    }
}

async function handleChat() {
    // Enter chat mode
    isChatMode = true;
    showChatMode();

    // Add initial message with selected text
    if (currentSelectedText) {
        addChatMessage('user', currentSelectedText);

        // Get AI response
        await getChatResponse(currentSelectedText);
    }
}

function showChatMode() {
    // Hide other sections
    resultSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    emptyState.classList.add('hidden');

    // Show chat section and input
    chatSection.classList.remove('hidden');
    chatInputContainer.classList.remove('hidden');

    // Focus on input
    chatInput.focus();
}

function addChatMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'chat-message-header';
    headerDiv.textContent = role === 'user' ? 'You' : 'AI Assistant';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'chat-message-content';
    contentDiv.textContent = content;

    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);

    // Store in history
    chatHistory.push({ role, content });

    // Scroll to bottom
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
}

async function getChatResponse(userMessage) {
    // Show loading indicator in chat
    const loadingMsgDiv = document.createElement('div');
    loadingMsgDiv.className = 'chat-message assistant';
    loadingMsgDiv.innerHTML = `
        <div class="chat-message-header">AI Assistant</div>
        <div class="chat-message-content">
            <div class="loading-container" style="padding: 10px 0;">
                <div class="spinner" style="width: 24px; height: 24px; border-width: 3px;"></div>
            </div>
        </div>
    `;
    loadingMsgDiv.id = 'loading-message';
    chatMessages.appendChild(loadingMsgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Disable send button while loading
    sendChatBtn.disabled = true;
    chatInput.disabled = true;

    const response = await sendToBackend(userMessage, 'chat');

    // Remove loading indicator
    const loadingMsg = document.getElementById('loading-message');
    if (loadingMsg) {
        loadingMsg.remove();
    }

    // Enable send button
    sendChatBtn.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();

    if (response.success) {
        addChatMessage('assistant', response.data);
    } else {
        addChatMessage('assistant', `Error: ${response.error}`);
    }
}

function sendMessage() {
    const message = chatInput.value.trim();

    if (!message) {
        return;
    }

    // Add user message to chat
    addChatMessage('user', message);

    // Clear input
    chatInput.value = '';
    resetTextareaHeight();

    // Get AI response
    getChatResponse(message);
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
summarizeBtn.addEventListener('click', handleSummarize);
translateBtn.addEventListener('click', handleTranslate);
searchBtn.addEventListener('click', handleSearch);
chatBtn.addEventListener('click', handleChat);

// Chat input handlers
sendChatBtn.addEventListener('click', sendMessage);

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

chatInput.addEventListener('input', autoResizeTextarea);

console.log('Side panel loaded');

