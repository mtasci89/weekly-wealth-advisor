const STORAGE_KEY = 'portfolyoai_api_keys';

export interface ApiKeys {
  yahooFinance: string;
  claude: string;
  tavily: string;
  gemini: string;
}

const DEFAULT_KEYS: ApiKeys = {
  yahooFinance: '',
  claude: '',
  tavily: '',
  gemini: '',
};

export function getApiKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KEYS;
    return { ...DEFAULT_KEYS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_KEYS;
  }
}

export function saveApiKeys(keys: ApiKeys): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function hasYahooKey(): boolean {
  return getApiKeys().yahooFinance.trim().length > 0;
}

export function hasClaudeKey(): boolean {
  return getApiKeys().claude.trim().length > 0;
}

export function hasTavilyKey(): boolean {
  return getApiKeys().tavily.trim().length > 0;
}

export function hasGeminiKey(): boolean {
  return getApiKeys().gemini.trim().length > 0;
}
