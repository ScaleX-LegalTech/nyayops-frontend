import { useSyncExternalStore } from 'react'

/** At most one file staged for the next document.create/document.create_version
 * PendingAction to pick up (proposal doc's "attach-first" flow decision). A
 * plain module singleton, not React state or context - the file has to
 * survive from ChatInputBar (where it's attached) to a PendingActionCard deep
 * inside ChatMessageList (where it's consumed on confirm), and HANDLERS in
 * pendingActionHandlers.ts is a module-scope map with a fixed
 * `execute: (pa) => Promise<unknown>` signature that can't take an extra
 * param without touching every other handler and PendingActionCard's call
 * site. */

// Mirrors backend v1's documents.py:27-43 - server stays authoritative, this
// is just early UX feedback before a network round trip.
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
])
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

let stagedFile: File | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

/** Validates and stages `file`, returning an error message (and leaving the
 * previous staged file, if any, untouched) or null on success. */
export function stageAttachment(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return `Unsupported file type: ${file.type || 'unknown'}.`
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'File exceeds the 50 MB upload limit.'
  }
  stagedFile = file
  notify()
  return null
}

export function getStagedAttachment(): File | null {
  return stagedFile
}

export function clearStagedAttachment(): void {
  stagedFile = null
  notify()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Reactive read for ChatInputBar's staged-file chip. */
export function useStagedAttachment(): File | null {
  return useSyncExternalStore(subscribe, () => stagedFile)
}
