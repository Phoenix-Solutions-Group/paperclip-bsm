# Stale issue interactions

Pending issue-thread interactions become **stale after seven full days** without
a response. The heartbeat scheduler checks them once at server startup and on
every configured scheduler interval.

The sweep does not approve, reject, expire, or duplicate a card. It atomically
sets the card's `escalatedAt` timestamp only when that field is still empty, so
retries and server restarts are safe. The original card remains pending and can
still be answered or withdrawn through the existing routes.

Board operators can list stale cards for a company with:

```http
GET /api/companies/{companyId}/interactions/stale
```

Results are oldest first and include age, escalation time, card creator and
resolver policy, issue identifier/title/status, and any issues currently
blocking that work. Company access checks apply to the route. This query is the
operator-visible nudge: it makes silent decisions discoverable without deciding
on the board's behalf.
