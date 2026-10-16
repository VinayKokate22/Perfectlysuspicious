# Sharing a friends test

The private room build can be hosted as a small test with friends on your own URL. It is not a CrazyGames submission or a completed public release gate. No hosting has been created by this change.

The selected setup is Vercel for the frontend and Render for the backend. Follow [the deployment steps](DEPLOYMENT.md) for the supplied configuration files and the two addresses to connect. The complete application option below remains available as an alternative.

## Host the complete application

Use a host that runs a long lived Node 24 service, supports WebSocket connections and provides HTTPS. Deploy the project with its public, server and core directories and package files. Do not upload only dist/0.1.0/client to a static host: that directory has no room server.

Install with `npm ci --omit=dev` and start with `npm start`. The application serves the frontend and the WebSocket endpoint from the same process. It accepts the hosting service's PORT environment variable and binds to all IPv4 interfaces by default.

Configure these environment variables in the hosting dashboard:

| Variable | Value |
| --- | --- |
| NODE_ENV | production |
| HOST | 0.0.0.0 |
| PUBLIC_MATCHMAKING | false |
| ALLOWED_ORIGINS | Your exact HTTPS game origin, such as https://play.example.com |
| PORT | Use the port supplied by the hosting service |

Keep backendUrl as null and platform as local for this independent test. Here local names the standalone profile; it does not limit the server to localhost. On the hosted HTTPS page the client connects to wss on the same hostname. The host must forward WebSocket upgrades for /play. The health endpoint is /health.

Run one application instance. Rooms and sessions live in memory, so restarts end current games. Multiple independent instances do not share room codes. Disable automatic scaling and idle suspension during a play session where the host supports those settings.

## Share with friends

Open the deployed HTTPS address. Create a private room, use Invite in the Room menu and send the copied URL to your friends. They can also open the same deployed address and enter the room code. Use at least three players to start.

Anyone who has the room code or invite can join. The room is not discoverable through an open matchmaking queue. A localhost invitation works only on the same computer; use the hosted URL for friends outside your network.

Before inviting a larger group, create a room on a phone and join it from a computer using a different network. Confirm that three people can start, submit clues, vote, chat between cases and reconnect. The current automated checks do not substitute for this physical device and hosted connection check.

## Restore open rooms later

Set PUBLIC_MATCHMAKING to true and restart the service. When the server serves the frontend too, it advertises that setting to the client. With Vercel serving a separate static frontend, also set PUBLIC_MATCHMAKING to true in Vercel and redeploy it. This restores Quick play and the preserved public room queue. The default is false. While disabled, the server rejects direct public matching requests and joining or resuming public rooms, even if a custom client bypasses the menu.

Keep guided practice available for players who want to learn before inviting friends.

## Remaining release work

The broader interface gate still includes the previously recorded U13 zoom issue and physical device review. Platform publication remains governed by docs/PLATFORM_GATES.md. Treat this hosted version as a friends test and collect feedback before a wider launch.
