# Page Deck AI

A Manifest V3 Chrome side-panel extension that lets you chat with clean, selectively trimmed content from one or more pages in your current research session.

## Run it locally

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this repository folder.
3. Visit a normal `http` or `https` page, click the extension icon, then choose **Capture active page**.
4. Open settings, add your API key and select your provider/model.

The key and session deck are stored with `chrome.storage.local`; requests are sent directly from the extension to the selected AI provider. Never use an API key you do not control.

## What is included

- Chrome Side Panel API and MV3 service worker
- Persisted multi-page session deck with page-level inclusion controls
- DOM cleanup that favours article/main content, strips boilerplate elements, and divides pages into H2/H3 sections
- Per-section controls and a selected-text-only mode
- Local, approximate token warning (`characters / 4`); replace this with `js-tiktoken` in a build step when you need model-accurate estimates
- BYOK direct requests for OpenAI Responses API, Anthropic Messages API, and Gemini `generateContent`

## Deliberate next upgrades

- Vendor `@mozilla/readability` for stronger article extraction, especially on irregular layouts.
- Add streaming responses and Markdown rendering.
- Encrypting a BYOK key is not generally meaningful when it must be available to the extension; make the local-storage privacy model explicit in the product UI.
- Add export/clear-deck controls and automated tests before publishing.
