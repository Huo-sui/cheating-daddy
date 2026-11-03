const AnthropicModule = require('@anthropic-ai/sdk');

const Anthropic = AnthropicModule.default || AnthropicModule;

const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';
const VALID_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const CLAUDE_MAX_TOKENS = 16000;

// Models that accept the server-side refusal fallback (`fallbacks: "default"`).
const SERVER_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);
const SERVER_FALLBACK_BETA = 'server-side-fallback-2026-07-01';

let cachedClient = null;
let cachedApiKey = null;

function getClient(apiKey) {
    if (!cachedClient || cachedApiKey !== apiKey) {
        cachedClient = new Anthropic({ apiKey });
        cachedApiKey = apiKey;
    }
    return cachedClient;
}

function normalizeModel(model) {
    return typeof model === 'string' && model.trim() !== '' ? model.trim() : DEFAULT_CLAUDE_MODEL;
}

function normalizeEffort(effort) {
    return VALID_EFFORTS.has(effort) ? effort : null;
}

function describeClaudeError(error) {
    if (error instanceof Anthropic.AuthenticationError) return 'Invalid Anthropic API key';
    if (error instanceof Anthropic.PermissionDeniedError) return 'Anthropic API key has no access to this model';
    if (error instanceof Anthropic.NotFoundError) return 'Claude model not found - check the model name in settings';
    if (error instanceof Anthropic.RateLimitError) return 'Claude rate limit reached - try again shortly';
    if (error instanceof Anthropic.BadRequestError) return `Claude rejected the request: ${error.message}`;
    if (error instanceof Anthropic.APIError && error.status) return `Claude API error ${error.status}: ${error.message}`;
    if (error instanceof Anthropic.APIConnectionError) return 'Could not reach the Anthropic API - check your network';
    return error?.message || 'Unknown Claude error';
}

/**
 * Streams a Claude response.
 *
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string} options.model
 * @param {string} options.effort - low | medium | high | xhigh | max
 * @param {string} options.system - system prompt (stable per session, so it is cached)
 * @param {Array} options.messages - Anthropic MessageParam[]
 * @param {(text: string) => void} options.onText - called with the full text so far
 * @param {AbortSignal} [options.signal] - aborts the request (throws APIUserAbortError)
 * @returns {Promise<{ text: string, stopReason: string|null, model: string }>}
 */
async function streamClaudeResponse({ apiKey, model, effort, system, messages, onText, signal }) {
    const client = getClient(apiKey);
    const modelId = normalizeModel(model);
    const effortLevel = normalizeEffort(effort);

    const params = {
        model: modelId,
        max_tokens: CLAUDE_MAX_TOKENS,
        // Explicit breakpoint on the stable system prompt (persona + background) and
        // automatic caching for the growing conversation tail.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        cache_control: { type: 'ephemeral' },
        messages,
    };

    if (effortLevel) {
        params.output_config = { effort: effortLevel };
    }

    const requestOptions = signal ? { signal } : undefined;
    const stream = SERVER_FALLBACK_MODELS.has(modelId)
        ? client.beta.messages.stream({ ...params, betas: [SERVER_FALLBACK_BETA], fallbacks: 'default' }, requestOptions)
        : client.messages.stream(params, requestOptions);

    let text = '';
    for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            text += event.delta.text;
            onText(text);
        }
    }

    const finalMessage = await stream.finalMessage();
    return {
        text,
        stopReason: finalMessage.stop_reason || null,
        model: finalMessage.model || modelId,
    };
}

function isAbortError(error) {
    return error instanceof Anthropic.APIUserAbortError || error?.name === 'AbortError';
}

module.exports = {
    DEFAULT_CLAUDE_MODEL,
    isAbortError,
    streamClaudeResponse,
    describeClaudeError,
};
