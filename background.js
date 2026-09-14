chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ settings: { provider: "openai", model: "gpt-4.1-mini", tokenLimit: 12000 } });
});
