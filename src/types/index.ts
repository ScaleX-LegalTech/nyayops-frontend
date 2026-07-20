// TS models mirroring the NyayOps backend Pydantic schemas.
// Split by domain (mirroring src/lib/api/*.ts's module boundaries) - this file is
// just a barrel so existing `import { X } from '@/types'` call sites don't need to
// change. Add new types to the matching domain file, not here.

export * from './cases'
export * from './threads'
export * from './auth'
export * from './dashboard'
export * from './documents'
export * from './admin'
export * from './audit'
export * from './notifications'
export * from './bills'
export * from './causeList'
export * from './cnrLookup'
