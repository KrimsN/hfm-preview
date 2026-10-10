/** Кэш с вытеснением давно не использованных записей: Map помнит порядок вставки. */
export class LruCache<K, V> {
  private readonly entries = new Map<K, V>();

  constructor(private readonly limit: number) {}

  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value !== undefined || this.entries.has(key)) {
      // перевставка делает запись самой свежей
      this.entries.delete(key);
      this.entries.set(key, value as V);
    }
    return value;
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
