<p align="center">
    <img src="src/lib/assets/Reef.png" style="width: 256px;">
</p>

<h1 align="center">
    Reef
</h1>

Reef is a web app that allows you to access features from the Nintendo Switch App. As well as show your Nintendo Switch Presence on Discord without a computer.

> Where does the name Reef come from?

Coral is the codename for the Nintendo Switch App, so its a play on that. As well as the Reef from Splatoon 2

## Features

- **Nintendo Account sign-in** — authenticates with Nintendo's Coral API using nxapi and stores the resulting session encrypted at rest.
- **Friends** — friends list, favourites, friend requests, adding friends by friend code or Discord username.
- **Presence & play activity** — who's online and what they're playing
- **Discord Rich Presence** — link a Discord account and share play activity.
- **Game services** — open supported Nintendo Switch App Game Web Services (for example SplatNet 3)
- **Notifications** — NSO announcements, friend requests and required notices.
- **Passkeys** — sign in with a passkey

## Getting started

```sh
git clone https://github.com/Bentheminernz/reef.git
cd reef
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

The app runs at http://localhost:5173.

## Configuration

| Variable                       | Description                                                       |
| ------------------------------ | ----------------------------------------------------------------- |
| `DATABASE_URL`                 | SQLite location, e.g. `file:local.db`                             |
| `WEBAUTHN_RP_NAME`             | Name shown by authenticators when creating a passkey              |
| `WEBAUTHN_RP_ID`               | Relying party ID                                                  |
| `WEBAUTHN_ORIGIN`              | Full origin the app is served from                                |
| `DISCORD_CLIENT_ID`            | Discord application client ID                                     |
| `DISCORD_CLIENT_SECRET`        | Discord application client secret                                 |
| `DISCORD_REDIRECT_URI`         | OAuth redirect, e.g. `http://localhost:5173/api/discord/callback` |
| `NXAPI_ZNCA_API_CLIENT_ID`     | nxapi-auth service client ID                                      |
| `NXAPI_ZNCA_API_CLIENT_SECRET` | nxapi-auth service client secret                                  |
| `APP_KEY`                      | Key used to encrypt Nintendo credentials before they are stored   |
| `APP_KEY_PREVIOUS`             | Optional previous `APP_KEY`, used during key rotation             |
| `JWT_KEY`                      | Secret used to sign session tokens                                |

Discord credentials come from the [Discord Developer Portal](https://discord.com/developers/applications) the redirect URI must point at `/api/discord/callback`.
nxapi znca credentials come from [nxapi-auth](https://nxapi-auth.fancy.org.uk)

## Contributing

Reef is primarily maintained by me ([Ben Lawrence](mailto:ben@reefpresence.app)). Pull Requests are not publicly accessible for a few reasons:

- This app handles peoples Nintendo Authentication Tokens
- I want to know and trust people contributing code to this app
- The recent rise of vibe coded slop, I don't want full slop AI code being contributed to Reef

## Credits

- [nxapi](https://github.com/samuelthomas2774/nxapi) - Amazing library by Ellie which allows your to authenticate with the Nintendo Switch App APIs
- [dootskyre](https://bsky.app/profile/dootsky.re) - Made the Reef icon, and helped a lot with feedback and ideas
- [Dycool/nso-webapp](https://github.com/Dycool/nso-webapp) - Helped with patching the Game Web Services to load in a web sandbox

## License

[GNU Affero General Public License v3.0](LICENSE). If you run a modified version of Reef as a network service, the AGPL requires you to offer the corresponding source to its users.

Reef is not affiliated with, endorsed by or sponsored by Nintendo or Discord. Nintendo Switch, Nintendo Switch Online and related names are trademarks of Nintendo; Discord is a trademark of Discord Inc.
