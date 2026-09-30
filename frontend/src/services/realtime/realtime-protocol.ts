/**
 * How the realtime socket authenticates: the access token travels as a WebSocket subprotocol
 * (`Sec-WebSocket-Protocol: professionals.v1, bearer.<JWT>`; the server selects
 * `professionals.v1`), never in the URL, so it stays out of proxy and load-balancer access logs
 * and out of the browser console (which prints the URL of a failing socket).
 */
export const REALTIME_PROTOCOL = 'professionals.v1';
const BEARER_PREFIX = 'bearer.';

/** The subprotocols to offer for `token` (a JWT only has characters a subprotocol may carry). */
export function realtimeProtocols(token: string): string[] {
  return [REALTIME_PROTOCOL, `${BEARER_PREFIX}${token}`];
}

/** The access token among offered subprotocols, or `null`. */
export function tokenFromProtocols(protocols: readonly string[]): string | null {
  const bearer = protocols.find((protocol) => protocol.startsWith(BEARER_PREFIX));
  return bearer ? bearer.slice(BEARER_PREFIX.length) : null;
}
