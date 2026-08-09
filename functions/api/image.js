const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
function reply(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS }); }

export async function onRequestPost({ request }) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ') || authorization.length < 25) return reply({ error: 'OpenAI APIキーが設定されていません。' }, 401);
  let body;
  try { body = await request.json(); } catch { return reply({ error: 'リクエスト形式が正しくありません。' }, 400); }
  const scene = String(body.prompt || '').trim();
  const sentence = String(body.sentence || '').trim();
  if (!scene) return reply({ error: '画像用プロンプトがありません。' }, 400);

  const prompt = `${scene}\n\nCreate a memorable educational illustration for this English sentence: ${sentence}\nNo text, no letters, no captions, no logos, no watermarks. One coherent scene, clear subjects, visually distinctive but not childish.`;

  let upstream;
  try {
    upstream = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-2', prompt, size: '1024x1024', quality: 'low', output_format: 'webp', output_compression: 65, n: 1 })
    });
  } catch {
    return reply({ error: 'OpenAI Image APIへ接続できませんでした。' }, 502);
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return reply({ error: data?.error?.message || `OpenAI Image APIエラー (${upstream.status})` }, upstream.status);
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) return reply({ error: '画像データを取得できませんでした。' }, 502);
  return reply({ b64, mime: 'image/webp' });
}
export function onRequest() { return reply({ error: 'Method not allowed' }, 405); }
