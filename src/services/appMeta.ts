export const APP_VERSION =
  typeof __APP_VERSION__ === "string" && __APP_VERSION__.trim().length > 0
    ? __APP_VERSION__.trim()
    : "0.0.0";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function normalizeSemver(value: string) {
  const [core] = String(value || "").split("-");
  const [major, minor, patch] = core.split(".").map((part) => Number(part) || 0);
  return {
    major,
    minor,
    patch,
  };
}

export function compareSemverValues(a: string, b: string): number {
  const av = normalizeSemver(a);
  const bv = normalizeSemver(b);
  if (av.major !== bv.major) return av.major > bv.major ? 1 : -1;
  if (av.minor !== bv.minor) return av.minor > bv.minor ? 1 : -1;
  if (av.patch !== bv.patch) return av.patch > bv.patch ? 1 : -1;
  return 0;
}

export function isValidSemver(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  return SEMVER_PATTERN.test(value.trim());
}

export function isMinAppVersionSatisfied(minAppVersion?: string): boolean {
  if (!minAppVersion) return true;
  if (!isValidSemver(minAppVersion) || !isValidSemver(APP_VERSION)) {
    return false;
  }
  return compareSemverValues(APP_VERSION, minAppVersion) >= 0;
}
