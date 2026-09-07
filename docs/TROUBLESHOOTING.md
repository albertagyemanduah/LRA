# Troubleshooting Guide

## Blank white screen after login

1. Open browser DevTools → Console — look for JavaScript errors.
2. Check PocketBase is running: `curl http://localhost:8090/api/health`
3. Verify `.env` has correct `PB_URL`.
4. Run `bash scripts/health-check.sh`.

## "Something went wrong" on import

- Verify file is CSV, XLS, or XLSX (not .xls opened in newer Excel and saved without changing format).
- Check file size is under 15 MB.
- Ensure your role is `admin` — only admins can import.
- Check browser console for the exact error message.

## PocketBase migration error on startup

```bash
# Check which migrations failed
npm run migrations:up --workspace pocketbase-app
```

- If a migration file has a syntax error, fix it and re-run.
- Never delete an already-applied migration.

## SMS not delivered

1. Verify `ARKESEL_API_KEY` in `.env`.
2. Check Arkesel dashboard for delivery status.
3. Check Express API logs: `pm2 logs api`
4. Confirm sender ID `TeNDA PPD` is approved in your Arkesel account.

## Password reset email not received

1. Check spam folder.
2. Verify `SMTP_*` variables in `.env`.
3. Test SMTP: `curl smtp://mail.yourdomain.com -u user:pass --ssl`
4. Check PocketBase hook logs: `pm2 logs pocketbase`

## Application won't start after HPanel deploy

1. Ensure Node.js 22.x is selected in HPanel → Advanced → Node.js.
2. Check that `apps/pocketbase/pocketbase` is executable: `chmod +x apps/pocketbase/pocketbase`.
3. Verify all `npm ci` packages installed successfully.
4. Check logs: `pm2 logs`

## PocketBase data not persisting after restart

- Ensure `pb_data/` directory is writable and not mounted as read-only.
- On HPanel, use absolute path for `--dir` in `ecosystem.config.cjs`.

## 502 Bad Gateway (nginx)

- API or PocketBase is not running: `pm2 list`
- Restart: `pm2 restart ecosystem.config.cjs`
- Check ports match between `nginx.conf` and `ecosystem.config.cjs`.

## Log Locations

| Service | Log |
|---|---|
| PocketBase | `logs/pocketbase-out.log` / `logs/pocketbase-error.log` |
| Express API | `logs/api-out.log` / `logs/api-error.log` |
| Nginx | `/var/log/nginx/error.log` |
| PM2 | `~/.pm2/logs/` |

## Support

For application issues contact the development team or open a ticket within the application (Tickets module).
