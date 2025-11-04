// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for messages from content scripts and forward to side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);

  if (request.action === 'textSelected') {
    // Forward message to side panel
    chrome.runtime.sendMessage(request).catch(() => {
      console.log('Side panel not open');
    });
  }

  if (request.action === 'openSidePanelWithAction') {
    // Open the side panel
    chrome.sidePanel.open({ windowId: sender.tab.windowId }).then(() => {
      // Wait a bit for side panel to load, then send the action
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: 'performAction',
          selectedText: request.selectedText,
          buttonAction: request.buttonAction
        }).catch(() => {
          console.log('Could not send to side panel');
        });
      }, 100);
    }).catch(err => {
      console.error('Could not open side panel:', err);
    });
  }

  sendResponse({ status: 'Message received' });
});

