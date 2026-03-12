import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearInstalledDomainPacks,
  saveInstalledDomainPackManifest,
} from '@/src/services/domains/packStore';
import {
  getDefaultRuntimeDomainPack,
  getRuntimeDomainPackById,
  resolveRuntimeDomainPack,
} from '@/src/domains/runtime/registry';

describe('runtime domain registry', () => {
  beforeEach(() => {
    const map = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        get length() {
          return map.size;
        },
        clear() {
          map.clear();
        },
        getItem(key: string) {
          return map.has(key) ? map.get(key)! : null;
        },
        key(index: number) {
          return Array.from(map.keys())[index] ?? null;
        },
        removeItem(key: string) {
          map.delete(key);
        },
        setItem(key: string, value: string) {
          map.set(key, value);
        },
      } satisfies Storage,
      configurable: true,
    });
    clearInstalledDomainPacks();
  });

  it('returns the built-in football runtime pack directly', () => {
    const pack = getRuntimeDomainPackById('football');
    expect(pack?.manifest.domainId).toBe('football');
    expect(pack?.manifest.supportedEventTypes).toContain('match');
    expect(pack?.sourceAdapters.length).toBeGreaterThan(1);
    expect(pack?.queryCatalog).toMatchObject({
      eventListQueryType: 'football_match_list',
      matchListQueryType: 'football_match_list',
    });
  });

  it('falls back from an installed metadata alias pack to its base runtime pack', () => {
    saveInstalledDomainPackManifest({
      id: 'custom-football-alias',
      version: '1.0.0',
      name: 'Custom Football Alias',
      description: 'Alias pack for football runtime behavior',
      baseDomainId: 'football',
    });

    const pack = getRuntimeDomainPackById('custom-football-alias');
    expect(pack?.manifest.domainId).toBe('football');
  });

  it('resolves unknown ids to the default runtime pack', () => {
    expect(resolveRuntimeDomainPack('unknown-domain').manifest.domainId).toBe(
      getDefaultRuntimeDomainPack().manifest.domainId,
    );
  });
});
