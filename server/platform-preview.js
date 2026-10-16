import { createGameServer } from './main.js';

// Review tooling only. The release build still emits the local configuration.
const game = createGameServer({ clientConfig: { backendUrl: null, platform: 'sdk-preview' } });
const port = 3001;
game.server.listen(port, '127.0.0.1', () => console.log(`SDK review preview: http://localhost:${port}`));
process.on('SIGINT', async () => { await game.close(); process.exit(0); });
