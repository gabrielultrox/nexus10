import { requestBackend } from './backendApi'

export const DEFAULT_REMOTE_ACCESS_PIN = '1664'
export const DEFAULT_REMOTE_ACCESS_PIN_MASK = 'PIN padrao configurado'

export async function verifyRemoteAccessPin(pin) {
  return requestBackend('/auth/access-pin/verify', {
    method: 'POST',
    skipAuth: true,
    body: {
      pin,
    },
  })
}

export async function getRemoteAccessPinStatus() {
  return requestBackend('/auth/access-pin')
}

export async function updateRemoteAccessPin(pin) {
  return requestBackend('/auth/access-pin', {
    method: 'PUT',
    body: {
      pin: pin ?? null,
    },
  })
}
