/** Returns ids of users whose "@FullName" appears in the text. */
export function extractMentionedUserIds(
  text: string,
  users: { id: string; full_name: string }[],
): string[] {
  return users.filter((u) => text.includes(`@${u.full_name}`)).map((u) => u.id)
}
