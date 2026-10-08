/**
 * Подписи для набора файлов, как у вкладок VS Code: имя файла, а если оно повторяется —
 * к нему добавляются родительские папки, пока подписи не станут уникальными.
 * Расширяются только совпадающие; остальные остаются короткими.
 */
export function uniqueLabels(paths: string[]): string[] {
  const segments = paths.map((p) => p.split(/[\\/]+/).filter(Boolean));
  const depth = paths.map(() => 1);
  const label = (i: number): string => segments[i]!.slice(-depth[i]!).join("/");

  for (let changed = true; changed; ) {
    changed = false;
    const groups = new Map<string, number[]>();
    segments.forEach((_, i) => {
      const key = label(i);
      groups.set(key, [...(groups.get(key) ?? []), i]);
    });
    for (const members of groups.values()) {
      if (members.length < 2) continue;
      for (const i of members) {
        if (depth[i]! < segments[i]!.length) {
          depth[i]!++;
          changed = true;
        }
      }
    }
  }
  return paths.map((_, i) => label(i));
}

export function previewTitle(label: string): string {
  return `Превью: ${label}`;
}
