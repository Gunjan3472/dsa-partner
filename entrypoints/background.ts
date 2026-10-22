const GEMINI_MODEL = 'gemini-3.8-flash';
const GROQ_MODEL = 'openai/gpt-oss-120b';

const BASE_RULES = `You are a friendly DSA teacher helping a student with a LeetCode problem.
If the student's code has a bug, point to where to look but do not fix it.
Never write the full solution code.`;

const LEVEL_PROMPTS: Record<string, string> = {
  nudge: `${BASE_RULES}
Give only a small NUDGE: one or two guiding questions. Do not name the algorithm or data structure. Under 60 words.`,
  concept: `${BASE_RULES}
Name the key concept or data structure the student should think about, and explain in 2-3 sentences why it fits. Do not give the full approach. Under 100 words.`,
  approach: `${BASE_RULES}
Explain the approach step by step in plain English, with no code. Mention the expected time and space complexity. Under 150 words.`,
  pseudocode: `${BASE_RULES}
Give clear pseudocode for the approach, not real code in any language. Add one line on the edge cases to watch for. Under 200 words.`,
  review: `${BASE_RULES}
You are reviewing the student's current code like a kind mentor. If the editor is empty or has only starter code, say so and ask them to write an attempt first.
Otherwise reply in exactly these parts:
1. What's good: one short line.
2. Bugs or logic problems: point to the line or area and explain WHY it's wrong, but do not give the corrected code.
3. Edge cases missed: list 2-3 specific inputs to test (for example empty input, duplicates, a single element).
4. Complexity: the time and space complexity of THEIR code, and whether it can be improved (a hint only, not the solution).
Under 220 words.`,
  teachback: `${BASE_RULES}
The student has explained their approach in words. Judge the explanation like a kind teacher. Reply in exactly these parts:
1. What's right: what they understood correctly.
2. What's missing or wrong: explain why, but do not give the full correct approach. Ask a guiding question instead.
3. Complexity check: if they stated a complexity, say whether it is right. If not, ask what they think it is.
4. One follow-up question to test their understanding.
If the explanation is empty or very vague, ask them to write more. Under 180 words.`,
  chat: `${BASE_RULES}
You are in an ongoing conversation with the student. Answer their latest message directly and kindly, using the earlier messages as context.
Prefer guiding questions and small steps over handing over answers. If they seem confused, explain the idea more simply with a tiny example.
If they ask for the full solution, encourage one more attempt first and offer a bigger hint instead.
Keep it conversational and under 150 words.`,
};

type Msg = { role: 'user' | 'model'; text: string };
type Result = { ok: true; text: string } | { ok: false; error: string };

async function getSettings() {
  const data = await browser.storage.local.get(['provider', 'keys', 'apiKey']);
  const keys = ((data.keys as Record<string, string>) ?? {}) as Record<string, string>;
  if (data.apiKey && !keys.gemini) keys.gemini = data.apiKey as string;
  const provider = (data.provider as string) || 'gemini';
  return { provider, apiKey: keys[provider] };
}

async function callGemini(apiKey: string, systemPrompt: string, messages: Msg[]): Promise<Result> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      }),
    }
  );
  const json = await res.json();
  if (!res.ok) return { ok: false, error: json?.error?.message || `Error ${res.status}` };
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? { ok: true, text } : { ok: false, error: 'Empty reply from Gemini.' };
}

async function callGroq(apiKey: string, systemPrompt: string, messages: Msg[]): Promise<Result> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.text,
        })),
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) return { ok: false, error: json?.error?.message || `Error ${res.status}` };
  const text = json?.choices?.[0]?.message?.content;
  return text ? { ok: true, text } : { ok: false, error: 'Empty reply from Groq.' };
}

async function callAI(systemPrompt: string, messages: Msg[]): Promise<Result> {
  const { provider, apiKey } = await getSettings();
  if (!apiKey) {
    return { ok: false, error: `No ${provider} key saved. Open Extension options first.` };
  }
  try {
    return provider === 'groq'
      ? await callGroq(apiKey, systemPrompt, messages)
      : await callGemini(apiKey, systemPrompt, messages);
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function contextText(m: any) {
  return `Problem: ${m.title}\n\n${m.description}\n\nStudent's ${m.language} code right now:\n${m.code}`;
}

async function getHint(m: any) {
  const systemPrompt = LEVEL_PROMPTS[m.level] ?? LEVEL_PROMPTS.nudge;
  const explanationPart = m.explanation
    ? `\n\nStudent's explanation of their approach:\n${m.explanation}`
    : '';
  return callAI(systemPrompt, [{ role: 'user', text: contextText(m) + explanationPart }]);
}

async function chat(m: any) {
  const history: Msg[] = m.history ?? [];
  const messages: Msg[] = [
    { role: 'user', text: contextText(m) },
    { role: 'model', text: 'Understood. I will guide the student as their teacher.' },
    ...history,
    { role: 'user', text: m.question },
  ];
  return callAI(LEVEL_PROMPTS.chat, messages);
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
    if (message?.type === 'get-hint') {
      getHint(message).then(sendResponse);
      return true;
    }
    if (message?.type === 'chat') {
      chat(message).then(sendResponse);
      return true;
    }
  });
});