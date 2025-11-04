// Side panel script
let currentSelectedText = '';

// Get references to DOM elements
const selectedTextSection = document.getElementById('selectedTextSection');
const selectedTextDisplay = document.getElementById('selectedText');
const loadingSection = document.getElementById('loadingSection');
const resultSection = document.getElementById('resultSection');
const resultDisplay = document.getElementById('result');
const emptyState = document.getElementById('emptyState');

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
    resultSection.classList.add('hidden');
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

// Mock HTTP request to backend
async function sendToBackend(text, action) {
    const mockBackendUrl = 'https://api.example.com/llm'; // Replace with your actual backend URL

    console.log('Preparing mock HTTP request to backend...');
    console.log('Action:', action);
    console.log('Text:', text);

    try {
        // Mock request body
        const requestBody = {
            action: action,
            text: text,
            timestamp: new Date().toISOString()
        };

        console.log('Request body:', requestBody);

        // Simulate network delay (2-4 seconds)
        const delay = 2000 + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));

        // Mock response from LLM
        const mockResponses = {
            summarize: `Here's a summary of your text:\n\n"${text}"\n\nThis is a mock AI-generated summary. In production, this would be the actual response from your LLM backend.`,
            translate: `Translation (Spanish):\n\n"${text}"\n\nEste es un resultado simulado. En producción, esto sería la traducción real de tu backend LLM.`,
            chat: `Chat Response:\n\nYou asked about: "${text}"\n\nThis is a mock conversational response. Your actual LLM would provide a meaningful answer here.`
        };

        return {
            success: true,
            data: mockResponses[action] || `Processed: ${text}`
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

function handleSearch() {
    // Search doesn't need backend call, opens directly
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(currentSelectedText)}`;
    chrome.tabs.create({ url: searchUrl });
    showResult('Web Search', 'Opening Google search for:\n\n"' + currentSelectedText + '"');
}

async function handleChat() {
    showLoading();
    const response = await sendToBackend(currentSelectedText, 'chat');

    if (response.success) {
        showResult('Chat', response.data);
    } else {
        showResult('Error', `Failed to get chat response: ${response.error}`);
    }
}

// Button handlers
summarizeBtn.addEventListener('click', handleSummarize);
translateBtn.addEventListener('click', handleTranslate);
searchBtn.addEventListener('click', handleSearch);
chatBtn.addEventListener('click', handleChat);

console.log('Side panel loaded');

