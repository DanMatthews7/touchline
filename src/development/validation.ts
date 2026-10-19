/** Demo files are JSON data, never executable objects or trusted derived state. */
export function assertPlainDemoData(input: unknown): void {
  let visited = 0;
  const ancestors = new WeakSet<object>();
  function visit(value: unknown, depth: number): void {
    if (++visited > 150_000 || depth > 24) throw new Error('Demo backup exceeds the supported data complexity.');
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint' || value === undefined || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('Demo backups must contain plain JSON data.');
    if (typeof value !== 'object' || value === null) return;
    const array = Array.isArray(value);
    const prototype: unknown = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error('Demo backups cannot contain custom prototypes.');
    if (ancestors.has(value)) throw new Error('Demo backups cannot contain circular data.');
    ancestors.add(value);
    let entries = 0;
    for (const key of Reflect.ownKeys(value)) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) throw new Error('Unsupported demo backup field.');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error('Demo backups cannot contain accessors or hidden fields.');
      entries++;
      visit(descriptor.value as unknown, depth + 1);
    }
    if (array && entries !== value.length) throw new Error('Demo backup arrays must not contain holes.');
    ancestors.delete(value);
  }
  visit(input, 0);
}
