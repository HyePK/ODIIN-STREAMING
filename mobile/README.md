# ODIIN STREAMING mobile apps

The main project is an installable PWA and the source of truth for the web, iOS, and Android experience. This Capacitor wrapper turns the same production build into native projects without maintaining a second interface.

## Create native projects

1. Build the root project with `npm run build`.
2. In this directory run `npm install`.
3. Run `npm run setup:ios` on macOS and `npm run setup:android` on a machine with Android Studio.
4. Run `npm run sync` after every web release.
5. Use `npm run open:ios` or `npm run open:android` to sign and submit the app.

The native bundle uses the same ODIIN STREAMING name, icon, responsive interface, schedule, library, and playback controls as the website.
