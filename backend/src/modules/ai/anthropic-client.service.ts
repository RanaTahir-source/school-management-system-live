import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

// Thin wrapper around the Anthropic Messages API, shared by the Question
// Paper Generator and Lesson Plan Generator. Both features ask the model for
// a strict JSON object (never prose) so the result can be stored structured
// and rendered into a PDF - this class handles sending the request, and
// robustly extracting the JSON even if the model wraps it in a markdown code
// fence or adds a stray sentence before/after it.
//
// Requires ANTHROPIC_API_KEY to be set in the environment. If it's missing,
// callers get a clear 503 rather than a confusing crash deep in JSON parsing -
// this is a real school feature, not a demo, so it should fail obviously when
// unconfigured rather than silently returning garbage.
@Injectable()
export class AnthropicClientService {
  private readonly logger = new Logger(AnthropicClientService.name);
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI features are not configured yet - ANTHROPIC_API_KEY is missing on the server. Ask your system administrator to add it.',
      );
    }
    if (!this.client) {
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  // Sends a system + user prompt and parses the reply as JSON of shape T.
  // `system` should explicitly instruct "respond with ONLY a JSON object,
  // no other text" - this method still defensively strips code fences and
  // leading/trailing prose in case the model doesn't follow that perfectly.
  async generateJson<T>(system: string, userPrompt: string): Promise<T> {
    const client = this.getClient();
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

    let response;
    try {
      response = await client.messages.create({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      });
    } catch (err) {
      this.logger.error(`Anthropic API call failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'The AI service could not be reached right now. Please try again in a moment.',
      );
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '';

    const jsonText = this.extractJson(rawText);
    try {
      return JSON.parse(jsonText) as T;
    } catch (err) {
      this.logger.error(`Could not parse AI response as JSON: ${rawText.slice(0, 500)}`);
      throw new InternalServerErrorException('The AI returned an unexpected format. Please try generating again.');
    }
  }

  private extractJson(text: string): string {
    const trimmed = text.trim();
    // Strip a ```json ... ``` or ``` ... ``` fence if present.
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fenceMatch ? fenceMatch[1] : trimmed;
    // Fall back to the first '{' through the last '}' in case the model
    // added a stray sentence before/after the JSON object.
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first === -1 || last === -1 || last < first) return candidate;
    return candidate.slice(first, last + 1);
  }
}
