export function getFriendlyErrorMessage(error, fallbackMessage) {
  const code = error?.code ?? '';
  const message = String(error?.message ?? '').trim();

  if (code === 'permission-denied' || /insufficient permissions/i.test(message)) {
    return 'Seu perfil nao tem permissao para acessar estes dados agora.';
  }

  if (code === 'unavailable') {
    return 'Servico temporariamente indisponivel. Tente novamente em instantes.';
  }

  if (message) {
    return message;
  }

  return fallbackMessage;
}
