export function compareConfigs(
  oldConfig: Record<string, unknown> | null | undefined, 
  newConfig: Record<string, unknown> | null | undefined
): { path: string, oldVal: unknown, newVal: unknown, type: 'added' | 'removed' | 'changed' }[] {
  const differences: { path: string, oldVal: unknown, newVal: unknown, type: 'added' | 'removed' | 'changed' }[] = [];

  function traverse(oldObj: Record<string, unknown> | undefined, newObj: Record<string, unknown> | undefined, path: string) {
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
    
    for (const key of Array.from(allKeys)) {
      const currentPath = path ? `${path}.${key}` : key;
      const oldVal = oldObj ? oldObj[key] : undefined;
      const newVal = newObj ? newObj[key] : undefined;

      if (oldVal === undefined && newVal !== undefined) {
        differences.push({ path: currentPath, oldVal, newVal, type: 'added' });
      } else if (oldVal !== undefined && newVal === undefined) {
        differences.push({ path: currentPath, oldVal, newVal, type: 'removed' });
      } else if (typeof oldVal === 'object' && oldVal !== null && typeof newVal === 'object' && newVal !== null) {
        traverse(oldVal as Record<string, unknown>, newVal as Record<string, unknown>, currentPath);
      } else if (oldVal !== newVal) {
        differences.push({ path: currentPath, oldVal, newVal, type: 'changed' });
      }
    }
  }

  traverse(oldConfig || undefined, newConfig || undefined, "");
  return differences;
}
