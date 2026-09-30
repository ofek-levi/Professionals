/**
 * Settings that are only safe with a real value once the API is reachable from the internet
 * (staging/production): the access-token and location-privacy secrets, the `trust proxy` setting and
 * the operator details of the legal documents. Development accepts the `.env.example` values (and
 * empty operator details) so a fresh checkout starts.
 */
import { isIP } from 'node:net';

/** 32 random bytes in base64url (43 characters) is the shortest secret we accept when deployed. */
const DEPLOYED_SECRET_MIN_LENGTH = 43;
/**
 * Estimated entropy (bits) a deployed secret must reach: 32 random base64url bytes estimate at
 * ≈ 200 bits, 32 random bytes in hex at ≈ 250.
 */
const DEPLOYED_SECRET_MIN_BITS = 160;
/** Markers of documentation and test values (`.env.example`, README, the test harness). */
const PLACEHOLDER_MARKERS = /change[-_ ]?me|placeholder|example|your[-_ ]?secret|secret[-_ ]of|test[-_ ]access[-_ ]secret|replace[-_ ]?me/i;

/**
 * Shannon estimate of the entropy of `value` (bits): its length times the entropy of its character
 * distribution. A heuristic, not a proof: it catches repeated characters, short alphabets and
 * words, while `openssl rand -base64 48` (≈ 380 bits) and `-hex 32` (≈ 245 bits) pass easily.
 */
function estimatedEntropyBits(value: string): number {
  const counts = new Map<string, number>();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let perChar = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    perChar -= p * Math.log2(p);
  }
  return perChar * value.length;
}

/** `abcabcabc`: a shorter unit repeated (the Shannon estimate does not see patterns). */
function isRepetition(value: string): boolean {
  for (let unit = 1; unit <= value.length / 2; unit += 1) {
    if (value.length % unit === 0 && value.slice(0, unit).repeat(value.length / unit) === value) return true;
  }
  return false;
}

/** Problems of `JWT_ACCESS_SECRET` for a deployed environment (anyone who knows it can sign in as anyone). */
export function deployedSecretIssues(secret: string): string[] {
  if (PLACEHOLDER_MARKERS.test(secret)) return ['JWT_ACCESS_SECRET is a placeholder: generate one with `openssl rand -base64 48`'];
  if (secret.length < DEPLOYED_SECRET_MIN_LENGTH || estimatedEntropyBits(secret) < DEPLOYED_SECRET_MIN_BITS || isRepetition(secret)) {
    return ['JWT_ACCESS_SECRET is too weak for a deployed environment: use at least 32 random bytes (`openssl rand -base64 48`)'];
  }
  return [];
}

/** `true` if the development secret is one of the documented placeholders (startup warning). */
export function isPlaceholderSecret(secret: string): boolean {
  return PLACEHOLDER_MARKERS.test(secret);
}

/** Problems of `LOCATION_PRIVACY_SECRET` when deployed (whoever knows it can undo the offset of approximate locations). */
export function locationSecretIssues(secret: string | undefined): string[] {
  return secret && isPlaceholderSecret(secret) ? ['LOCATION_PRIVACY_SECRET is a placeholder: generate one with `openssl rand -base64 48`'] : [];
}

/** The operator fields of `src/config/legal.ts` the published documents cannot do without. */
export interface LegalOperator {
  name: { en: string; he: string };
  address: { en: string; he: string };
  email: string;
}

const LEGAL_CONFIG_FILE = 'backend/src/config/legal.ts';
const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Problems of the operator details for a deployed environment: the documents must say who runs the service and how to reach them. */
export function legalOperatorIssues(operator: LegalOperator, appEnv: string): string[] {
  const empty = Object.entries({
    'operator.name.en': operator.name.en,
    'operator.name.he': operator.name.he,
    'operator.address.en': operator.address.en,
    'operator.address.he': operator.address.he,
    'operator.email': operator.email,
  })
    .filter(([, value]) => !value.trim())
    .map(([field]) => field);
  const issues =
    empty.length > 0
      ? [`${LEGAL_CONFIG_FILE}: fill in ${empty.join(', ')} (the Terms of Use and the Privacy Policy name the operator; required when APP_ENV=${appEnv})`]
      : [];
  const email = operator.email.trim();
  if (email && !EMAIL_ADDRESS.test(email)) issues.push(`${LEGAL_CONFIG_FILE}: operator.email is not an email address: ${email}`);
  return issues;
}

/** Express `trust proxy` value: hop count, address/subnet list, or off. */
export type TrustProxy = boolean | number | string[];

const PROXY_NAMES = new Set(['loopback', 'linklocal', 'uniquelocal']);

function isAddressOrSubnet(entry: string): boolean {
  if (PROXY_NAMES.has(entry)) return true;
  const [address = '', prefix, extra] = entry.split('/');
  const family = isIP(address);
  if (family === 0 || extra !== undefined) return false;
  if (prefix === undefined) return true;
  if (!/^\d{1,3}$/.test(prefix)) return false;
  return Number(prefix) <= (family === 4 ? 32 : 128);
}

/**
 * Parses `TRUST_PROXY`. `true` trusts every `X-Forwarded-For` hop, so any client could pick the IP
 * every per-IP limit sees: refused when deployed, where the value must name the proxies (a hop
 * count or their addresses/subnets), or be `false` when clients connect directly.
 */
export function parseTrustProxy(value: string | undefined, deployed: boolean): { value: TrustProxy; issues: string[] } {
  if (value === undefined) {
    return deployed
      ? {
          value: false,
          issues: ['TRUST_PROXY is required when deployed: the number of proxies in front of the API (e.g. 1), their subnets, or false'],
        }
      : { value: false, issues: [] };
  }
  if (value === 'false') return { value: false, issues: [] };
  if (value === 'true') {
    return deployed
      ? { value: false, issues: ['TRUST_PROXY=true lets any client spoof its IP (X-Forwarded-For): use a hop count or subnets'] }
      : { value: true, issues: [] };
  }
  if (/^\d{1,2}$/.test(value)) return { value: Number(value), issues: [] };
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const invalid = entries.filter((entry) => !isAddressOrSubnet(entry));
  if (entries.length === 0 || invalid.length > 0) {
    return { value: false, issues: [`TRUST_PROXY: not a hop count, address or subnet: ${invalid.join(', ') || value}`] };
  }
  return { value: entries, issues: [] };
}
