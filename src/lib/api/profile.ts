import type { MyProfileUpdateRequest, User } from '@/types'
import { get, patch } from './client'

export function getMe(): Promise<User> {
  return get<User>('/users/me')
}

export function updateMe(payload: MyProfileUpdateRequest): Promise<User> {
  return patch<User>('/users/me', payload)
}
