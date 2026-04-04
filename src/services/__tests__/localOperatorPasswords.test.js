import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearOperatorPassword,
  DEFAULT_OPERATOR_PASSWORD,
  getOperatorAccessPassword,
  getOperatorPasswordSummary,
  hasCustomOperatorPassword,
  setOperatorPassword,
  verifyOperatorPassword,
} from '../localOperatorPasswords'

describe('local operator passwords', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('uses the default password when no custom password exists', () => {
    expect(getOperatorAccessPassword('Gabriel')).toBe(DEFAULT_OPERATOR_PASSWORD)
    expect(verifyOperatorPassword('Gabriel', DEFAULT_OPERATOR_PASSWORD)).toBe(true)
  })

  it('stores and verifies a custom password per operator', () => {
    setOperatorPassword('Gabriel', '654321')

    expect(hasCustomOperatorPassword('Gabriel')).toBe(true)
    expect(getOperatorAccessPassword('Gabriel')).toBe('654321')
    expect(verifyOperatorPassword('Gabriel', '654321')).toBe(true)
    expect(verifyOperatorPassword('Gabriel', DEFAULT_OPERATOR_PASSWORD)).toBe(false)
  })

  it('clears a custom password and falls back to the default password', () => {
    setOperatorPassword('Gabriel', '654321')
    clearOperatorPassword('Gabriel')

    expect(hasCustomOperatorPassword('Gabriel')).toBe(false)
    expect(getOperatorAccessPassword('Gabriel')).toBe(DEFAULT_OPERATOR_PASSWORD)
    expect(getOperatorPasswordSummary('Gabriel')).toEqual({
      operatorName: 'Gabriel',
      hasCustomPassword: false,
      maskedPassword: DEFAULT_OPERATOR_PASSWORD,
    })
  })
})
