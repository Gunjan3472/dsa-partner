const providerSelect = document.getElementById('provider') as HTMLSelectElement;
const keyInput = document.getElementById('key') as HTMLInputElement;
const saveBtn = document.getElementById('save') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

type Keys = Record<string, string>;

async function loadKeys(): Promise<{ provider: string; keys: Keys }> {
  const data = await browser.storage.local.get(['provider', 'keys', 'apiKey']);
  const keys: Keys = (data.keys as Keys) ?? {};
  // Move an older single key into the new format
  if (data.apiKey && !keys.gemini) keys.gemini = data.apiKey as string;
  return { provider: (data.provider as string) || 'gemini', keys };
}

async function showCurrent() {
  const { keys } = await loadKeys();
  keyInput.value = keys[providerSelect.value] ?? '';
}

(async () => {
  const { provider } = await loadKeys();
  providerSelect.value = provider;
  await showCurrent();
})();

providerSelect.addEventListener('change', showCurrent);

saveBtn.addEventListener('click', async () => {
  const { keys } = await loadKeys();
  keys[providerSelect.value] = keyInput.value.trim();
  await browser.storage.local.set({ provider: providerSelect.value, keys });
  statusEl.textContent = 'Saved!';
  setTimeout(() => (statusEl.textContent = ''), 2000);
});

export {};