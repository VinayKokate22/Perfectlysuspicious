# Deploy with Vercel and Render

This project is prepared for a private room friends test. Vercel serves the game screen and Render runs the multiplayer server. Both services use the same GitHub repository. No account has been connected and no deployment has been created by this setup.

## Use one repository and two deployments

Create only one private GitHub repository for the entire project. For example, you could name it suspiciousgame. Connect that same repository to both Render and Vercel, using the same branch on both.

The code stays together on GitHub. The hosting settings tell each service what to build or run:

| Setting | Render backend | Vercel frontend |
| --- | --- | --- |
| GitHub repository | suspiciousgame | The same suspiciousgame repository |
| Branch | Your chosen branch, usually main | The same branch |
| Root Directory | Repository root, leave blank | Repository root, leave unchanged |
| Configuration file | render.yaml | vercel.json |
| What runs | The multiplayer server through npm start | The static frontend built by npm run build:web |
| Address | The backend address used in GAME_BACKEND_URL | The game address you share with friends |

Keep Root Directory at the top of the repository on both services. Do not select public for Vercel or server for Render. The frontend needs the build scripts and package files at the top level, and the backend also needs the shared core folder.

The deployment order is Render first, Vercel second, then return to Render to allow the new Vercel address. Steps 2 to 4 below explain each part.

## 1. Put the project on GitHub

Publish the complete local project folder D:\project\browser_game as one private GitHub repository using GitHub Desktop or Git. Commit the source folders, documentation, package.json and package-lock.json. The existing .gitignore excludes dependencies, generated builds, local environment files and test output when committing with Git.

After uploading, opening the repository on GitHub should immediately show package.json, vercel.json and render.yaml. You should not have to open another browser_game folder to find them. The important files should appear like this:

```text
suspiciousgame repository
    public/
    server/
    core/
    scripts/
    tests/
    docs/
    release/
    .gitignore
    package.json
    package-lock.json
    vercel.json
    render.yaml
```

Upload public, server and core together. Keep the repository private because the server source includes the game word pack. Vercel publishes only the generated browser assets from its configured output directory; the server source is not part of that browser output.

## 2. Create the Render backend

The render.yaml file is already prepared. Use the Blueprint option so Render reads the settings from that file. Follow these steps in order:

1. Open your repository on GitHub. Confirm render.yaml and package.json are visible at the top level and that your latest changes are uploaded.
2. Open [the Render dashboard](https://dashboard.render.com/) and create an account or sign in. Complete any account verification Render requests.
3. In the dashboard, click New, then Blueprint.
4. Connect your GitHub account if prompted. Authorize access to this game's repository. In Render's repository list, click Connect beside that repository. Select the complete project repository, the same one you will later use with Vercel.
5. Enter a Blueprint name such as SuspiciousGame. Select the branch containing your uploaded code, usually main. Keep Blueprint Path as render.yaml.
6. When prompted for ALLOWED_ORIGINS, enter https://setup.invalid if Vercel is not deployed yet. If you already have the Vercel production URL, enter its exact HTTPS origin with no trailing slash. The temporary value is intentional: the backend can start, but browser players will connect only after step 4 of this guide replaces it with the real game address.
7. Review the proposed service. It should be the Node web service named perfectly-suspicious-server on the Free compute plan. The supplied file creates one service and no database. Check the displayed plan before proceeding.
8. Click Deploy Blueprint. Wait for Render to finish building and starting the service. If Render reports an error, keep the error text from the build or service logs so the failure can be diagnosed.
9. Open the created web service. Copy its public HTTPS address from the service page. Append /health to that address and open it in a browser. The response below confirms the backend is running.

The dashboard sequence follows [Render's Blueprint setup instructions](https://render.com/docs/infrastructure-as-code). A Blueprint reads the build command, start command and other settings from render.yaml, so you do not need to type them again.

The configured build command is npm ci --omit=dev, the start command is npm start and the health check is /health. Node 24 is selected by package.json. If a Root Directory setting is shown, leave it blank at the repository root.

The other variables are already in render.yaml:

```text
NODE_ENV=production
HOST=0.0.0.0
PUBLIC_MATCHMAKING=false
```

Let Render supply PORT. Leave the root directory at the repository root. Do not select a static site for the backend. Wait for the service to become healthy, then copy its public HTTPS address. Opening that address with /health appended should return:

```json
{"ok":true}
```

The Blueprint selects the Free compute plan for setup testing. Render Free services sleep after 15 minutes without inbound traffic and can take about a minute to wake. Render may also restart them. For smoother sharing, choose a paid compute plan after reviewing its cost. This is a service compute setting, separate from the workspace plan. [Render Free service limitations](https://render.com/docs/free)

If you keep Free, open the backend /health URL and wait for it to respond before your first test. The hosted client allows up to 90 seconds for a WebSocket connection and displays connection progress and errors inside the room-entry dialog. If the hosting proxy rejects the connection while the service wakes, retry after /health responds. Sleeping or restarting clears this game's current rooms.

## 3. Create the Vercel frontend

Have your Render service's public HTTPS address ready before starting. Use the service address ending in .onrender.com, without /health. The dashboard.render.com address is the management page and cannot be used as the backend address.

1. Open [Vercel's New Project page](https://vercel.com/new) and sign in.
2. Connect your GitHub account if needed. Find the same repository you used on Render and click Import. There is no second repository to create or copy. Use the same branch.
3. Give the project a name such as perfectlysuspicious. Set Framework Preset to Other and leave Root Directory at the repository root. Do not select public or server.
4. Leave the build overrides unchanged. The included vercel.json supplies npm ci as the install command, npm run build:web as the build command and dist/hosted/client as the output directory. These settings come from the file even if the form does not display all of them. Use Node 24 if a version selector is shown.
5. Expand Environment Variables. Add GAME_BACKEND_URL with the actual Render HTTPS service address as its value. Add PUBLIC_MATCHMAKING with false as its value. If environment choices are shown, make sure Production is included.
6. Click Deploy and wait for a successful build. If a build fails, copy its error text from the build logs.
7. Open the project's production domain and copy its HTTPS origin. Use the stable game domain, such as https://YOUR_GAME.vercel.app. Complete step 4 of this guide before testing rooms: Render still needs to allow that address.

The GitHub import flow is described in [Vercel's dashboard deployment guide](https://vercel.com/docs/getting-started-with-vercel#deploy-from-the-dashboard). The build settings come from [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json).

Before deploying, add these environment variables to Production:

```text
GAME_BACKEND_URL=wss://YOUR_RENDER_SERVICE.onrender.com/play
PUBLIC_MATCHMAKING=false
```

Replace YOUR_RENDER_SERVICE with your actual Render hostname. An HTTPS Render address also works: the build converts it to a secure WebSocket address ending in /play. The hosted build fails clearly if the backend address is absent or invalid. There is no need to edit public/config.js.

Use Node 24. Deploy, then copy the stable production address, such as https://YOUR_GAME.vercel.app. Share that address with players. They do not need the Render URL.

The build writes only public connection settings into config.js. These settings are visible to browsers and are not secrets. Environment changes require a new frontend deployment. Keep platform as local; this names the independent hosting profile and works on public HTTPS websites.

## 4. Connect the two services

In the Render service's Environment settings, set ALLOWED_ORIGINS to the exact Vercel production origin:

```text
ALLOWED_ORIGINS=https://YOUR_GAME.vercel.app
```

Include https and omit a trailing slash or path. Save and redeploy the backend. For a custom domain, use its exact origin instead. Multiple origins can be separated by commas with no spaces. Keep one backend instance and do not enable autoscaling: room state currently lives in that process's memory.

Vercel preview deployments have different origins. For initial sharing, use the stable production address. To test a preview, add its exact origin on Render and configure the Vercel Preview environment variables too. An origin that is not listed cannot connect to the game server.

## 5. Check before sending invitations

1. Open the Vercel production URL on your laptop and phone, preferably on different networks.
2. Confirm the home screen offers Create a private room and Join room.
3. Create a room, use Invite and check the copied URL starts with your Vercel address.
4. Join from a second device with the invite and a third browser session with the room code.
5. Start with three players. Submit clues, vote, finish a case and send chat between cases.
6. Refresh one player and confirm they reconnect to the same room.
7. Check toast placement, chat visibility and controls on your actual phone and tablet.

Anyone with the room code or invite can join. Public matchmaking is disabled in both the frontend build and backend service. Guided practice remains available.

## Updating the game

Both services can deploy future commits from the connected GitHub repository. Backend redeploys or restarts end current rooms, so deploy between play sessions. Keep frontend and backend changes compatible while their separate deployments finish.

To restore open matchmaking later, set PUBLIC_MATCHMAKING to true on both services, rebuild the frontend and restart the backend. The preserved queue implementation is still present.

## If something does not connect

If the frontend build fails, check GAME_BACKEND_URL is set in the correct Vercel environment. If the game cannot connect, first open Render /health, then check the deployed frontend's /config.js contains the correct wss address and that Render ALLOWED_ORIGINS matches the exact browser address. A room disappearing after a backend restart is expected with the current memory based storage.

This setup supports a friends test. It does not complete CrazyGames submission, the previously recorded zoom layout issue or physical device review. See FRIENDS_TEST.md and PLATFORM_GATES.md for the remaining release gates.
