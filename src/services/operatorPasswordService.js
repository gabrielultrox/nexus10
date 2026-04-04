import { requestBackend } from './backendApi'

export async function listRemoteOperatorPasswords() {
  return requestBackend('/auth/operator-passwords')
}

export async function updateRemoteOperatorPassword({ operatorName, password }) {
  return requestBackend('/auth/operator-passwords', {
    method: 'PUT',
    body: {
      operatorName,
      password: password ?? null,
    },
  })
}
