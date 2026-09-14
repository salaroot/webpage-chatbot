const $ = (selector) => document.querySelector(selector);
const state = { pages: [], settings: {}, messages: [] };
const defaultModels = { openai: "gpt-4.1-mini", anthropic: "claude-3-5-haiku-latest", gemini: "gemini-2.0-flash" };

await hydrate();
bindEvents();

async function hydrate() {
  const saved = await chrome.storage.local.get(["deck", "settings"]);
  state.pages = saved.deck || [];
  state.settings = { provider: "openai", model: defaultModels.openai, tokenLimit: 12000, ...(saved.settings || {}) };
  ["provider", "model", "apiKey", "tokenLimit"].forEach((id) => { $("#" + id).value = state.settings[id] || ""; });
  render();
}
function bindEvents() {
  $("#settingsButton").onclick = () => { $("#settings").hidden = !$("#settings").hidden; };
  $("#provider").onchange = (e) => { $("#model").value = defaultModels[e.target.value]; };
  $("#saveSettings").onclick = async () => { state.settings = Object.fromEntries(["provider", "model", "apiKey", "tokenLimit"].map(id => [id, $("#" + id).value])); state.settings.tokenLimit = Number(state.settings.tokenLimit) || 12000; await chrome.storage.local.set({ settings: state.settings }); $("#settings").hidden = true; };
  $("#capturePage").onclick = captureActivePage;
  $("#allSections").onclick = () => { document.querySelectorAll(".section-check").forEach(box => box.checked = true); persistSectionChoices(); };
  $("#selectionOnly").onchange = updateEstimate;
  $("#prompt").oninput = updateEstimate;
  $("#send").onclick = send;
}
async function captureActivePage() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url || "")) return showError("Open a regular web page before capturing it.");
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPage });
    const old = state.pages.findIndex(p => p.url === result.url);
    const page = { ...result, id: crypto.randomUUID(), included: true, sectionIncluded: result.sections.map(() => true) };
    if (old >= 0) page.id = state.pages[old].id, state.pages[old] = page; else state.pages.unshift(page);
    await saveDeck(); render();
  } catch { showError("Chrome could not read this page. Browser-internal pages and some protected sites cannot be captured."); }
}
function extractPage() {
  const selected = window.getSelection()?.toString().trim() || "";
  const root = document.querySelector("article, main, [role='main']") || document.body;
  const copy = root.cloneNode(true);
  copy.querySelectorAll("script,style,noscript,nav,footer,header,aside,form,button,svg,iframe").forEach(n => n.remove());
  const text = (node) => node.innerText.replace(/\n{3,}/g, "\n\n").trim();
  const headings = [...copy.querySelectorAll("h2,h3")];
  const sections = headings.map((heading, i) => {
    let content = heading.innerText + "\n"; let node = heading.nextElementSibling;
    while (node && !["H2", "H3"].includes(node.tagName)) { content += text(node) + "\n"; node = node.nextElementSibling; }
    return { title: heading.innerText.trim() || `Section ${i + 1}`, text: content.trim() };
  }).filter(s => s.text.length > 20);
  return { url: location.href, title: document.title || location.hostname, capturedAt: Date.now(), selected, text: text(copy), sections };
}
function render() {
  const deck = $("#deck"); deck.replaceChildren(); $("#emptyDeck").hidden = Boolean(state.pages.length);
  state.pages.forEach((page, index) => { const el = $("#pageTemplate").content.firstElementChild.cloneNode(true); const check = el.querySelector(".page-check"); check.checked = page.included; check.onchange = async () => { page.included = check.checked; await saveDeck(); renderSections(); updateEstimate(); }; el.querySelector(".page-title").textContent = page.title; el.querySelector(".page-url").textContent = page.url; el.querySelector(".remove-page").onclick = async () => { state.pages.splice(index, 1); await saveDeck(); render(); }; deck.append(el); });
  renderSections(); renderMessages(); updateEstimate();
}
function renderSections() { const parent = $("#sections"); parent.replaceChildren(); const pages = state.pages.filter(p => p.included && p.sections.length); $("#sectionsSection").hidden = !pages.length; pages.forEach(page => { const details = document.createElement("details"); details.open = true; const summary = document.createElement("summary"); summary.textContent = page.title; details.append(summary); page.sections.forEach((section, i) => { const label = document.createElement("label"); label.className = "section-row"; const box = document.createElement("input"); box.type = "checkbox"; box.className = "section-check"; box.checked = page.sectionIncluded[i]; box.onchange = persistSectionChoices; label.append(box, " " + section.title); details.append(label); }); parent.append(details); }); }
async function persistSectionChoices() { let n = 0; state.pages.filter(p => p.included && p.sections.length).forEach(p => p.sectionIncluded = p.sections.map(() => document.querySelectorAll(".section-check")[n++].checked)); await saveDeck(); updateEstimate(); }
function context() { if ($("#selectionOnly").checked) return state.pages.find(p => p.included)?.selected || ""; return state.pages.filter(p => p.included).map(p => { const selected = p.sections.length ? p.sections.filter((_, i) => p.sectionIncluded[i]).map(s => s.text).join("\n\n") : p.text; return `SOURCE: ${p.title}\nURL: ${p.url}\n${selected}`; }).join("\n\n---\n\n"); }
function estimateTokens(value) { return Math.ceil(value.length / 4); }
function updateEstimate() { const count = estimateTokens(context() + $("#prompt").value); $("#tokenEstimate").textContent = `${count.toLocaleString()} estimated tokens`; const warning = $("#warning"); warning.hidden = count <= state.settings.tokenLimit; warning.textContent = `This exceeds your ${state.settings.tokenLimit.toLocaleString()} token warning. Trim sections or raise the limit.`; }
async function send() { const prompt = $("#prompt").value.trim(), source = context(); if (!prompt) return; if (!source) return showError($("#selectionOnly").checked ? "Select text on a captured page first." : "Select or capture at least one page."); const user = `${prompt}\n\nContext:\n${source}`; state.messages.push({ role: "user", text: prompt }); $("#prompt").value = ""; renderMessages(); try { const text = await askProvider(user); state.messages.push({ role: "assistant", text }); } catch (error) { state.messages.push({ role: "error", text: error.message || "The AI request failed." }); } renderMessages(); }
async function askProvider(input) { const { provider, model, apiKey } = state.settings; if (!apiKey) throw new Error("Add an API key in Settings to start chatting."); let url, options; if (provider === "openai") { url = "https://api.openai.com/v1/responses"; options = { headers: { Authorization: `Bearer ${apiKey}` }, body: { model, input } }; } else if (provider === "anthropic") { url = "https://api.anthropic.com/v1/messages"; options = { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: { model, max_tokens: 1024, messages: [{ role: "user", content: input }] } }; } else { url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`; options = { headers: {}, body: { contents: [{ parts: [{ text: input }] }] } }; } const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...options.headers }, body: JSON.stringify(options.body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message || "Provider rejected the request."); return provider === "openai" ? data.output_text : provider === "anthropic" ? data.content?.map(b => b.text || "").join("") : data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join(""); }
async function saveDeck() { await chrome.storage.local.set({ deck: state.pages }); }
function renderMessages() { const root = $("#conversation"); root.replaceChildren(); state.messages.forEach(message => { const el = document.createElement("div"); el.className = `message ${message.role}`; el.textContent = message.text; root.append(el); }); }
function showError(text) { state.messages.push({ role: "error", text }); renderMessages(); }
