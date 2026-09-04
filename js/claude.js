// Calls the Anthropic Messages API directly from the browser using the
// user's own API key (entered in Settings, stored in this device's
// IndexedDB and included in exported backups on request — never sent
// anywhere but api.anthropic.com). Anthropic disables client-side use of its SDKs by
// default because a key embedded in browser JS is visible to anyone
// inspecting network requests; the "dangerous direct browser access" header
// below is Anthropic's own documented opt-in for exactly this shape of app
// (a personal, single-user tool running entirely in one person's browser).
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-5';

async function callClaude(apiKey, body, workspaceId) {
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: Object.assign({
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }, workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}),
      body: JSON.stringify(body)
    });
  } catch (e) {
    throw new Error('Could not reach Claude — check your connection and try again.');
  }
  if (!res.ok) {
    let msg = 'Claude API error (' + res.status + ').';
    try { const err = await res.json(); if (err && err.error && err.error.message) msg = err.error.message; } catch (e) { /* non-JSON error body */ }
    if (res.status === 401) msg = 'That API key was rejected. Check it in Settings.';
    if (res.status === 429) msg = 'Rate limited by Claude — wait a moment and try again.';
    // "identity-linked" API keys span multiple workspaces and reject every
    // request until told which workspace to run in — surface that as a
    // pointer to the field we added for it rather than the raw API wording.
    if (res.status === 400 && /workspace/i.test(msg)) msg = 'This API key needs a Workspace ID too — add it in Settings under Claude fashion match.';
    throw new Error(msg);
  }
  const data = await res.json();
  const textBlock = (data.content || []).find(b => b.type === 'text');
  if (!textBlock) throw new Error('Claude returned no usable response.');
  try { return JSON.parse(textBlock.text); } catch (e) { throw new Error("Could not parse Claude's response."); }
}

// Downscales+recompresses a photo before it goes anywhere near the API —
// wardrobe/camera photos are far larger than useful here, and image cost is
// pixel-driven, so this is what keeps a multi-candidate match affordable.
export function resizeImageToBase64(blob, maxEdge) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxEdge || height > maxEdge) {
        const scale = maxEdge / Math.max(width, height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      resolve({ base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
    img.src = url;
  });
}

// Stage 1: look at the inspiration photo alone and describe it in terms of
// this wardrobe's own vocabulary (exact category/jewellery-type names), so
// the result can be used to pull real candidates out of the closet.
export async function analyzeInspiration(apiKey, base64, mediaType, cats, jtypes, moods, workspaceId) {
  const schema = {
    type: 'object',
    properties: {
      mood: { type: 'string', enum: moods },
      summary: { type: 'string' },
      slots: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: cats },
            jtype: { type: 'string', enum: jtypes.concat(['']) },
            description: { type: 'string' }
          },
          required: ['category', 'jtype', 'description'],
          additionalProperties: false
        }
      }
    },
    required: ['mood', 'summary', 'slots'],
    additionalProperties: false
  };
  const prompt = 'This is a photo of an outfit someone likes — the inspiration, not necessarily their own clothes. ' +
    'List every distinct wearable piece visible as a "slot": the main garment(s), each jewellery piece as its own slot, footwear, and a bag if visible. ' +
    'For "category" use exactly one of the allowed category names. For a jewellery slot, set "jtype" to exactly one of the allowed jewellery type names; for every non-jewellery slot set "jtype" to an empty string. ' +
    'In "description", note that piece\'s color(s), pattern, and style in one short sentence — it will be used to find visually similar pieces later. ' +
    'In "summary", describe the overall look in one sentence. Pick the single closest "mood" from the allowed list.';
  const body = {
    model: MODEL,
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: prompt }
      ]
    }],
    output_config: { format: { type: 'json_schema', schema } }
  };
  const result = await callClaude(apiKey, body, workspaceId);
  result.slots = (result.slots || []).map(s => ({ ...s, jtype: s.jtype || null }));
  return result;
}

// Stage 2: show Claude the inspiration photo again alongside real candidate
// photos pulled from the closet (already filtered to the right category by
// the caller), and ask it to actually compare them visually slot by slot.
export async function matchCandidates(apiKey, base64, mediaType, slots, workspaceId) {
  const content = [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
    { type: 'text', text: "That's the inspiration photo. Below are real candidate pieces from this person's own wardrobe, grouped by slot. For each slot, pick the single candidate that is the closest visual match to what that slot needs (color, pattern, silhouette, style) — not just the same category. If none of a slot's candidates are a reasonable match, set has_match to false for that slot rather than forcing a pick." }
  ];
  slots.forEach((sl, i) => {
    content.push({ type: 'text', text: 'Slot ' + i + ' (' + (sl.jtype || sl.category) + '): ' + sl.description });
    sl.images.forEach(img => {
      content.push({ type: 'text', text: 'Item id=' + img.id + ':' });
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } });
    });
  });
  const schema = {
    type: 'object',
    properties: {
      slot_matches: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slot_index: { type: 'integer' },
            has_match: { type: 'boolean' },
            best_item_id: { type: 'integer' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            reasoning: { type: 'string' },
            alternate_item_ids: { type: 'array', items: { type: 'integer' } }
          },
          required: ['slot_index', 'has_match', 'best_item_id', 'confidence', 'reasoning', 'alternate_item_ids'],
          additionalProperties: false
        }
      }
    },
    required: ['slot_matches'],
    additionalProperties: false
  };
  const body = {
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content }],
    output_config: { format: { type: 'json_schema', schema } }
  };
  return callClaude(apiKey, body, workspaceId);
}
