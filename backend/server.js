import { backendEnv } from './config/env.js';
import app from './app.js';
import { logger, serializeError } from './logging/logger.js';

const server = app.listen(backendEnv.port, () => {
  logger.info({
    context: 'server.start',
    port: backendEnv.port,
    environment: backendEnv.nodeEnv,
  }, `nexus-ifood backend ativo em http://127.0.0.1:${backendEnv.port} (${backendEnv.nodeEnv})`);
});

server.on('error', (error) => {
  logger.error({
    context: 'server.start',
    error: serializeError(error),
  }, 'Backend server failed to start');
});
