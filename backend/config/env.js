import fs from 'node:fs';
import path from 'node:path';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const rawContents = fs.readFileSync(filePath, 'utf8');

  rawContents.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      value.length >= 2
      && (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      )
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  });
}

parseEnvFile(path.resolve(process.cwd(), '.env'));

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function required(name, fallback = '') {
  return process.env[name] ?? fallback;
}

function requiredInProduction(name, fallback = '') {
  const value = process.env[name];

  if (value != null && value !== '') {
    return value;
  }

  if ((process.env.NODE_ENV ?? 'development') === 'production') {
    throw new Error(`Variavel obrigatoria ausente em producao: ${name}`);
  }

  return fallback;
}

export const backendEnv = {
  port: asNumber(process.env.PORT, 8787),
  nodeEnv: required('NODE_ENV', 'development'),
  localOperatorPassword: requiredInProduction('LOCAL_OPERATOR_PASSWORD', '01'),
  openaiApiKey: process.env.OPENAI_API_KEY ?? null,
  frontendOrigin: required('FRONTEND_ORIGIN', '').split(',').map((item) => item.trim()).filter(Boolean),
  ifoodAuthBaseUrl: required('IFOOD_AUTH_BASE_URL', 'https://merchant-api.ifood.com.br/authentication/v1.0'),
  ifoodMerchantBaseUrl: required('IFOOD_MERCHANT_BASE_URL', 'https://merchant-api.ifood.com.br'),
  ifoodEventsPollingPath: required('IFOOD_EVENTS_POLLING_PATH', '/events/v1.0/events:polling'),
  ifoodEventsAckPath: required('IFOOD_EVENTS_ACK_PATH', '/events/v1.0/events/acknowledgment'),
  ifoodOrderDetailsPath: required('IFOOD_ORDER_DETAILS_PATH', '/order/v1.0/orders'),
  ifoodWebhookUrl: required('IFOOD_WEBHOOK_URL', ''),
  ifoodWebhookSecret: required('IFOOD_WEBHOOK_SECRET', ''),
  ifoodPollingIntervalSeconds: asNumber(process.env.IFOOD_POLLING_INTERVAL_SECONDS, 30),
  firebaseProjectId: required('FIREBASE_ADMIN_PROJECT_ID', process.env.VITE_FIREBASE_PROJECT_ID ?? ''),
  firebaseClientEmail: required('FIREBASE_ADMIN_CLIENT_EMAIL', ''),
  firebasePrivateKey: required('FIREBASE_ADMIN_PRIVATE_KEY', '').replace(/\\n/g, '\n'),
};

export function hasFirebaseAdminConfig() {
  return Boolean(
    backendEnv.firebaseProjectId
    && backendEnv.firebaseClientEmail
    && backendEnv.firebasePrivateKey,
  );
}
