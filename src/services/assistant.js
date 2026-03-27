import { requestBackend } from './backendApi'

export async function queryAssistant({ storeId, message, context = {} }) {
  if (!storeId) {
    throw new Error('Selecione uma loja antes de usar a NEXA.')
  }

  return requestBackend(`/stores/${storeId}/assistant/query`, {
    method: 'POST',
    body: {
      message,
      context,
    },
  })
}
