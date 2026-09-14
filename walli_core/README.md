# walli_core

<p align="center">
  <img src="../docs/assets/walli-core-robot.png" alt="walli original robot mascot" width="680" />
</p>

<p align="center">
  <a href="../README.md">English</a> · <a href="../README.zh-CN.md">简体中文</a>
</p>

`walli_core` is the core backend package of the walli project. See the root documentation:

- [English](../README.md)
- [简体中文](../README.zh-CN.md)

## Web chat bot verification

Web settings include an optional **Bot verification** switch (off by default), independent of Google login. It uses Cloudflare Turnstile and protects session creation, sending messages, image uploads, transcription and session deletion. Each request uses a fresh token; the Worker validates the token with Siteverify and checks the action, exact frontend hostname and client ID. History reads do not trigger challenges.

Create a managed Turnstile widget for your frontend domains, then configure these Worker environment values:

- `TURNSTILE_SITE_KEY`: the public widget site key.
- `TURNSTILE_SECRET`: the private widget secret, stored using your existing secret manager; never expose it in frontend code or commit it.
- `TURNSTILE_HOSTNAMES`: comma-separated allowed frontend hostnames, without protocol or port. Production must list only its real frontend domains, never `localhost` or `127.0.0.1`. Local development uses its own hostname list.

Local placeholders are in `.dev.vars.example`. Enable the switch after configuration. Missing keys, failed validation or unavailable Siteverify all block protected requests. Google sign-in still completes first, and the saved question continues through bot verification after returning.

Before enabling in production, verify a successful protected request using a real widget token, then replay the same token and confirm rejection. Automated tests use mocked Siteverify responses; they do not validate a real widget or secret.
