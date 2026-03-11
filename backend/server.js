import { backendEnv } from './config/env.js';
import app from './app.js';

app.listen(backendEnv.port, () => {
  console.log(
    `nexus-ifood backend ativo em http://127.0.0.1:${backendEnv.port} (${backendEnv.nodeEnv})`,
  );
});
