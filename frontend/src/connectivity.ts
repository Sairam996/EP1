/**
 * Server-reachability store (no React). The api client reports each request's
 * outcome here; after 2+ consecutive network failures / timeouts / 502-504 the
 * server is marked down. The OfflineOverlay subscribes, probes while down and
 * flips it back up. `onReconnect` lets screens refetch after recovery.
 */
type Listener = () => void;

const FAIL_THRESHOLD = 2;
let consecutiveFailures = 0;
let serverDown = false;
const stateListeners = new Set<Listener>();
const reconnectListeners = new Set<Listener>();

function emit(set: Set<Listener>) { set.forEach((l) => { try { l(); } catch { /* ignore */ } }); }

export function isServerDown() { return serverDown; }

export function subscribeServerState(l: Listener) {
  stateListeners.add(l);
  return () => { stateListeners.delete(l); };
}

/** Called by the api client after any request that reached the server healthily. */
export function reportServerOk() {
  consecutiveFailures = 0;
  if (serverDown) { serverDown = false; emit(stateListeners); }
}

/** Called by the api client on network error, timeout or gateway (502/503/504) failure. */
export function reportServerFailure() {
  consecutiveFailures += 1;
  if (!serverDown && consecutiveFailures >= FAIL_THRESHOLD) { serverDown = true; emit(stateListeners); }
}

/** True when a status code means "backend unreachable" rather than an app-level error. */
export function isGatewayStatus(status: number) { return status === 502 || status === 503 || status === 504; }

/** Subscribe to "connection restored" (internet or server came back). Returns an unsubscribe fn. */
export function onReconnect(l: Listener) {
  reconnectListeners.add(l);
  return () => { reconnectListeners.delete(l); };
}

export function emitReconnect() { emit(reconnectListeners); }
