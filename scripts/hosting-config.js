import assert from 'node:assert/strict';

// Only public connection settings enter the static client bundle.
export function hostedClientConfig(env) {
  assert.ok(env.GAME_BACKEND_URL?.trim(),'Set GAME_BACKEND_URL to the Render WebSocket address before building.');
  const url=new URL(env.GAME_BACKEND_URL.trim());
  assert.ok(['https:','wss:'].includes(url.protocol),'GAME_BACKEND_URL must use HTTPS or WSS.');
  assert.ok(!url.username&&!url.password&&!url.search&&!url.hash,'GAME_BACKEND_URL must not contain credentials, a query or a fragment.');
  assert.ok(url.pathname==='/'||url.pathname==='/play','GAME_BACKEND_URL must use the /play endpoint.');
  assert.ok(!['localhost','127.0.0.1','[::1]','0.0.0.0'].includes(url.hostname),'GAME_BACKEND_URL must be a hosted address.');
  url.protocol='wss:';url.pathname='/play';
  assert.ok([undefined,'false','true'].includes(env.PUBLIC_MATCHMAKING),'PUBLIC_MATCHMAKING must be true or false.');
  return {backendUrl:url.href,platform:'local',publicMatchmaking:env.PUBLIC_MATCHMAKING==='true'};
}
