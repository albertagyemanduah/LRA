# Configuration Guide

All runtime configuration is controlled by the `.env` file at the project root.
**Never commit `.env` to version control.**

## Environment Variables Reference

### Application
| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | ✓ | `production` | `production` or `development` |
| `APP_NAME` | | — | Display name in emails/SMS |
| `APP_URL` | ✓ | — | Full public URL, e.g. `https://yourdomain.com` |
| `APP_PORT` | | `3000` | Vite dev server port |

### PocketBase
| Variable | Required | Description |
|---|---|---|
| `PB_URL` | ✓ | Internal PocketBase URL, e.g. `http://localhost:8090` |
| `PB_ENCRYPTION_KEY` | ✓ | 64-char hex — run `openssl rand -hex 32` |
| `PB_SUPERUSER_EMAIL` | First run | Superuser email for initial setup |
| `PB_SUPERUSER_PASSWORD` | First run | Superuser password (min 10 chars) |

### Express API
| Variable | Required | Description |
|---|---|---|
| `API_PORT` | | Express port (default `3001`) |
| `JWT_SECRET` | ✓ | Secret for signing JWTs — `openssl rand -hex 64` |
| `CORS_ORIGINS` | ✓ | Comma-separated allowed origins |

### Arkesel SMS
| Variable | Required | Description |
|---|---|---|
| `ARKESEL_API_KEY` | ✓ | Obtain from arkesel.com dashboard |
| `ARKESEL_SMS_SENDER` | | Sender ID shown on SMS (default `TeNDA PPD`) |
| `ARKESEL_BASE_URL` | | API base (default `https://sms.arkesel.com/api/v2`) |

### Email / SMTP
| Variable | Required | Description |
|---|---|---|
| `SMTP_HOST` | ✓ | Mail server hostname |
| `SMTP_PORT` | | `465` (SSL) or `587` (STARTTLS) |
| `SMTP_SECURE` | | `true` for port 465 |
| `SMTP_USER` | ✓ | SMTP username / email address |
| `SMTP_PASSWORD` | ✓ | SMTP password |
| `SMTP_FROM` | | Display name + address |

### File Uploads
| Variable | Description |
|---|---|
| `MAX_FILE_SIZE` | Max upload in bytes (default 15 MB = `15728640`) |
| `ALLOWED_MIME_TYPES` | Comma-separated list of accepted MIME types |

### Session & Security
| Variable | Description |
|---|---|
| `SESSION_SECRET` | Session signing secret |
| `SESSION_TIMEOUT_MS` | Idle timeout ms (default `1800000` = 30 min) |
| `RATE_LIMIT_MAX` | Max API requests per window |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window ms |

## Secrets Management

- Rotate `PB_ENCRYPTION_KEY` and `JWT_SECRET` regularly.
- Store secrets in your hosting panel's environment variable manager rather than `.env` files on shared hosting.
- On HPanel: Settings → **Environment Variables** (Node.js app settings).

## CORS

Set `CORS_ORIGINS` to a comma-separated list of your front-end origins:

```
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

For local dev: `http://localhost:3000`.
