import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function callAI(messages, maxTokens = 400) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    });

    return response.choices?.[0]?.message?.content ?? null;

  } catch (err) {
    console.error('[OpenAI] Erro:', err.message);
    return null;
  }
}