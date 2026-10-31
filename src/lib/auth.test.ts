import { describe, expect, it } from 'vitest'
import { cleanCode, codeReady, friendlyCodeError } from './auth'

describe('email code sign in', () => {
  it('keeps only the digits, so a pasted code with spaces or a dash works', () => {
    expect(cleanCode('123 456')).toBe('123456')
    expect(cleanCode('123-456')).toBe('123456')
    expect(cleanCode(' 12a3b456 ')).toBe('123456')
    expect(cleanCode('12345678901234')).toBe('1234567890') // never longer than Supabase allows
  })
  it('is ready from 6 digits', () => {
    expect(codeReady('12345')).toBe(false)
    expect(codeReady('123456')).toBe(true)
    expect(codeReady('12345678')).toBe(true)
    expect(codeReady('abcdef')).toBe(false)
  })
  it('says a wrong or old code in plain words, and passes other problems through the usual wording', () => {
    expect(friendlyCodeError('Token has expired or is invalid')).toBe('That code is wrong or has expired. Ask for a new one.')
    expect(friendlyCodeError('Email rate limit exceeded')).toBe('Too many tries. Wait a minute, then try again.')
    expect(friendlyCodeError('Something odd')).toBe('Something odd')
  })
})
