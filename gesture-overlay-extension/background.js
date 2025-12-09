chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  // Inject JS
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js'],
  });

  // Inject CSS
  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ['content.css'],
  });
});
