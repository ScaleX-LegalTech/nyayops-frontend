export const permissionKey = (p: { resource: string; action: string; scope: string }) =>
  `${p.resource}:${p.action}:${p.scope}`
