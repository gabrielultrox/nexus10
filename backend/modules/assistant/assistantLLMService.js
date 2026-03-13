import OpenAI from 'openai';

import { backendEnv } from '../../config/env.js';

const openai = backendEnv.openaiApiKey
  ? new OpenAI({ apiKey: backendEnv.openaiApiKey })
  : null;

export async function queryLLM({ message, context, dataContext }) {
  if (!openai) {
    throw new Error('LLM não configurado');
  }

  const systemPrompt = 'Você é NEXA, assistente operacional do ERP Hora Dez Conveniência. O ERP gerencia pedidos, vendas, clientes, produtos, estoque, entregadores e financeiro. Responda de forma direta e operacional, em português, sem floreios. Máximo de 3 frases. Nunca invente dados — use apenas as informações fornecidas no contexto.';
  const userContent = dataContext?.length > 0
    ? `Contexto: ${JSON.stringify(context ?? {})}\nDados encontrados: ${JSON.stringify(dataContext)}\n\nPergunta: ${message}`
    : `Contexto: ${JSON.stringify(context ?? {})}\nPergunta: ${message}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 300,
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

  return response.choices[0].message.content;
}
