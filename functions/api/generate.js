const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function outputText(data) {
  const parts = [];
  for (const item of data?.output || []) {
    if (item?.type !== 'message') continue;
    for (const c of item?.content || []) if (c?.type === 'output_text' && typeof c.text === 'string') parts.push(c.text);
  }
  return parts.join('\n').trim();
}

export async function onRequestPost({ request }) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ') || authorization.length < 25) return reply({ error: 'OpenAI APIキーが設定されていません。' }, 401);

  let body;
  try { body = await request.json(); } catch { return reply({ error: 'リクエスト形式が正しくありません。' }, 400); }

  const date = String(body.date || '');
  const day = Number(body.day || 1);
  const phase = body.phase || {};
  const seen = Array.isArray(body.seenWords) ? body.seenWords.filter(x => typeof x === 'string').slice(-4000) : [];
  const avoid = seen.length ? seen.join(', ') : '(none yet)';

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      words: {
        type: 'array', minItems: 5, maxItems: 5,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            word: { type: 'string' }, pos: { type: 'string' }, meaning: { type: 'string' }, note: { type: 'string' }
          },
          required: ['word','pos','meaning','note']
        }
      },
      sentence: { type: 'string' },
      translation: { type: 'string' },
      imagePrompt: { type: 'string' }
    },
    required: ['words','sentence','translation','imagePrompt']
  };

  const instructions = `You design high-quality English vocabulary lessons for a Japanese high-school student preparing for university entrance examinations. Choose exactly five useful entrance-exam words appropriate to the requested phase. Never reuse any word in the avoid list. Prefer words that are genuinely useful in reading passages; avoid obscure specialist jargon. Then write ONE natural, grammatical English sentence that uses all five target words in their normal senses. Do not force awkward collocations. Keep the sentence challenging but readable for the specified level. Meanings and notes must be concise Japanese. The image prompt must describe one coherent visual scene that helps remember the sentence; do not include visible text, letters, captions, logos, or vocabulary words in the image.`;

  const input = `Lesson date: ${date}\nStudy day: ${day}\nPhase: ${phase.label || ''}\nLevel guidance: ${phase.level || ''}\nAlready used words to avoid: ${avoid}`;

  let upstream;
  try {
    upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        reasoning: { effort: 'low' },
        instructions,
        input,
        text: { format: { type: 'json_schema', name: 'five_words_lesson', strict: true, schema } }
      })
    });
  } catch {
    return reply({ error: 'OpenAI APIへ接続できませんでした。' }, 502);
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return reply({ error: data?.error?.message || `OpenAI APIエラー (${upstream.status})` }, upstream.status);

  try {
    const parsed = JSON.parse(outputText(data));
    if (!Array.isArray(parsed.words) || parsed.words.length !== 5) throw new Error();
    return reply(parsed);
  } catch {
    return reply({ error: '教材データを正しく生成できませんでした。もう一度お試しください。' }, 502);
  }
}

export function onRequest() { return reply({ error: 'Method not allowed' }, 405); }
