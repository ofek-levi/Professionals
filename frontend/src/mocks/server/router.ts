/**
 * Minimal REST router: route table with `:param` segments, method matching, typed query parsing
 * and per-route authentication requirements.
 */
import { DomainError } from '@/features/shared/domain-error';
import { vm } from '@/lib/validation/messages';
import type { HttpMethod, QueryValue } from '@/services/api/transport';
import type { AppLanguage } from '@/types/domain';

import { requireRole, requireUser, type Actor, type CustomerActor, type ProfessionalActor } from './auth';
import type { ServerContext } from './context';

// ────────────────────────────── Query parsing ──────────────────────────────

/**
 * Query string reader. Values are normalized to strings first (exactly what a real server would
 * receive), then parsed: comma separated arrays, numbers and booleans. Invalid values → 422.
 */
export class QueryReader {
  constructor(private readonly values: Readonly<Record<string, string>>) {}

  /** Merges the structured transport query with a `?a=b` suffix of the path, if any. */
  static from(query: Record<string, QueryValue> | undefined, search = ''): QueryReader {
    const values: Record<string, string> = {};
    if (search) {
      for (const part of search.replace(/^\?/, '').split('&')) {
        if (!part) continue;
        const [rawKey, ...rest] = part.split('=');
        try {
          const value = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
          if (value !== '') values[decodeURIComponent(rawKey)] = value;
        } catch {
          throw DomainError.validation({ [rawKey]: [vm('invalid')] }, 'Malformed query string');
        }
      }
    }
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        if (value.length > 0) values[key] = value.map(String).join(',');
      } else {
        values[key] = String(value);
      }
    }
    return new QueryReader(values);
  }

  private invalid(key: string): never {
    throw DomainError.validation({ [key]: [vm('invalid')] }, `Invalid query parameter "${key}"`);
  }

  string(key: string): string | undefined {
    const value = this.values[key]?.trim();
    return value ? value : undefined;
  }

  number(key: string): number | undefined {
    const raw = this.string(key);
    if (raw === undefined) return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value)) this.invalid(key);
    return value;
  }

  integer(key: string, bounds: { min?: number; max?: number } = {}): number | undefined {
    const value = this.number(key);
    if (value === undefined) return undefined;
    if (!Number.isInteger(value)) this.invalid(key);
    if (bounds.min !== undefined && value < bounds.min) this.invalid(key);
    if (bounds.max !== undefined && value > bounds.max) this.invalid(key);
    return value;
  }

  boolean(key: string): boolean | undefined {
    const raw = this.string(key)?.toLowerCase();
    if (raw === undefined) return undefined;
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    return this.invalid(key);
  }

  list(key: string): string[] | undefined {
    const raw = this.string(key);
    if (raw === undefined) return undefined;
    const items = raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  enumValue<T extends string>(key: string, allowed: readonly T[]): T | undefined {
    const raw = this.string(key);
    if (raw === undefined) return undefined;
    if (!(allowed as readonly string[]).includes(raw)) this.invalid(key);
    return raw as T;
  }

  enumList<T extends string>(key: string, allowed: readonly T[]): T[] | undefined {
    const items = this.list(key);
    if (!items) return undefined;
    if (items.some((item) => !(allowed as readonly string[]).includes(item))) this.invalid(key);
    return items as T[];
  }
}

// ────────────────────────────── Routes ──────────────────────────────

export type RouteAuth = 'public' | 'user' | 'customer' | 'professional';

type ActorFor<A extends RouteAuth> = A extends 'customer'
  ? CustomerActor
  : A extends 'professional'
    ? ProfessionalActor
    : A extends 'user'
      ? Actor
      : Actor | null;

export interface RouteRequest<TActor> {
  ctx: ServerContext;
  actor: TActor;
  params: Record<string, string>;
  query: QueryReader;
  body: unknown;
  headers: Record<string, string>;
  /** Preferred language from `Accept-Language` (defaults to English). */
  language: AppLanguage;
}

/** Explicit response with a non-200 status (e.g. `201 Created`). */
export class RouteResponse {
  constructor(
    readonly status: number,
    readonly data: unknown,
  ) {}
}

export const created = (data: unknown) => new RouteResponse(201, data);

interface RouteDefinition<A extends RouteAuth> {
  method: HttpMethod;
  /** Path pattern such as `/requests/:requestId/offers`. */
  path: string;
  auth: A;
  handler: (request: RouteRequest<ActorFor<A>>) => unknown;
}

export interface CompiledRoute {
  method: HttpMethod;
  path: string;
  auth: RouteAuth;
  segments: string[];
  /** Validates the caller against `auth` and invokes the handler. */
  invoke: (request: RouteRequest<Actor | null>) => unknown;
}

const splitSegments = (path: string) => path.split('/').filter(Boolean);

function authorize<A extends RouteAuth>(auth: A, actor: Actor | null): ActorFor<A> {
  switch (auth) {
    case 'customer':
      return requireRole(actor, 'customer') as ActorFor<A>;
    case 'professional':
      return requireRole(actor, 'professional') as ActorFor<A>;
    case 'user':
      return requireUser(actor) as ActorFor<A>;
    default:
      return actor as ActorFor<A>;
  }
}

/** Declares a route. The handler receives an actor typed by the auth requirement. */
export function route<A extends RouteAuth>(definition: RouteDefinition<A>): CompiledRoute {
  return {
    method: definition.method,
    path: definition.path,
    auth: definition.auth,
    segments: splitSegments(definition.path),
    invoke: (request) => definition.handler({ ...request, actor: authorize(definition.auth, request.actor) }),
  };
}

interface RouteMatch {
  route: CompiledRoute;
  params: Record<string, string>;
}

export class Router {
  constructor(private readonly routes: readonly CompiledRoute[]) {}

  match(method: HttpMethod, path: string): RouteMatch | null {
    const segments = splitSegments(path);
    for (const candidate of this.routes) {
      if (candidate.method !== method || candidate.segments.length !== segments.length) continue;
      const params: Record<string, string> = {};
      let matched = true;
      for (let i = 0; i < segments.length; i += 1) {
        const pattern = candidate.segments[i];
        if (pattern.startsWith(':')) {
          try {
            params[pattern.slice(1)] = decodeURIComponent(segments[i]);
          } catch {
            matched = false;
            break;
          }
        } else if (pattern !== segments[i]) {
          matched = false;
          break;
        }
      }
      if (matched) return { route: candidate, params };
    }
    return null;
  }
}

/** Splits `/path?query` into its parts. */
export function splitPath(rawPath: string): { path: string; search: string } {
  const index = rawPath.indexOf('?');
  return index === -1 ? { path: rawPath, search: '' } : { path: rawPath.slice(0, index), search: rawPath.slice(index + 1) };
}

/** Picks the first supported language of an `Accept-Language` header. */
export function languageFromHeaders(headers: Record<string, string> | undefined): AppLanguage {
  const entry = Object.entries(headers ?? {}).find(([name]) => name.toLowerCase() === 'accept-language');
  const value = entry?.[1]?.toLowerCase() ?? '';
  return /^(he|iw)\b/.test(value) ? 'he' : 'en';
}
