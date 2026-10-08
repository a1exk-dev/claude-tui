# What Claude Code's `spend_limit` window measures (Claude Code 2.1.292)

Scope: issue #146, for the map #144 (monthly cost against a limit) and the grilling ticket #149 (the month cost row next to the `spend` window). Every claim cites a primary source. **Inferred** marks a conclusion drawn from the sources rather than stated by them. **Unverified** marks what neither the sources nor a live run settles.

**Source keys**

- **DTS**: `vendor/claude-code-types/claude-code/index.d.ts`, header "Written by Claude Code 2.1.292." (L1). Line numbers are for that file.
- **BIN**: the installed binary `~/.local/share/mise/installs/claude/2.1.292/claude` (`claude --version` prints `2.1.292 (Claude Code)`). Read with `strings -n 6 <binary> > strings.txt`; "BIN Ln" is a line of that dump. The code is minified, so each citation also quotes a distinctive snippet to grep for.
- **CC:x Ln**: `https://code.claude.com/docs/en/x.md`, fetched 2026-10-08, at that line of the `.md` file.
- **HC**: Claude Help Center, "Usage credits for paid Claude plans", `https://support.claude.com/en/articles/12429409-extra-usage-for-paid-claude-plans`, fetched 2026-10-08. The binary links the same article as its extra-usage help page (BIN L480100: `VYt="https://support.claude.com/en/articles/12429409-extra-usage-for-paid-claude-plans"`).
- **ctui**: files in this repo at `release/0.3.0` (`ada1ef4`).

## 1. Question

Claude Code can report a `spend_limit` rate-limit window, which the `limits` Sidebar plugin shows as `spend`. What does it measure (extra usage on a plan? an org spend cap?), in what period, and on which accounts does it appear? The answer decides whether the month cost row overlaps it on a plan.

## 2. Short answer

- **It is the Claude apps gateway's per-developer spend cap, and nothing else.** It is not plan extra usage (usage credits), and not a Team or Enterprise org cap set on claude.ai. Claude Code only fills `spend_limit` when its provider is `gateway`, meaning the developer signed in to a self-hosted Claude apps gateway through `/login` (§3.2, §3.3).
- **What it measures:** the share used of the developer's own cap on that gateway. That cap is set by a gateway admin per user, per IdP group or as an org-wide per-seat default. The spend is the gateway's USD estimate priced from token counts, not a billed amount (§3.4).
- **Period:** `daily`, `weekly` or `monthly`, chosen by the admin per cap. Caps reset on UTC calendar boundaries: 00:00 UTC, Monday, and the 1st. With several caps, the window describes the fullest one (§3.4).
- **Accounts:** only developers signed in to a Claude apps gateway who have a cap. It never appears on a Pro, Max, Team or Enterprise plan, on an API key, or on Bedrock, Vertex or Foundry used directly (§3.3).
- **Overlap on a plan: none.** On a plan, Claude Code 2.1.292 never reports a `spend` window, so the month cost row and `spend` cannot both show (§5).
- **Side finding that matters for #144.** A gateway developer gets `rateLimits` holding only `spend_limit`. So the map's rule "Plan = `usage.rateLimits` non-empty" counts a gateway sign-in as a plan (§5.2).

## 3. Findings

### 3.1 The types name it as a gateway window

- `SessionRateLimit.kind`: "Which window: `five_hour`, `seven_day`, or a Claude gateway's `spend_limit`." (DTS L11208-11209).
- `percentUsed` is "0 to 100 with at most one decimal … past 100 on an exceeded spend limit". `resetsAt` is an ISO 8601 timestamp (DTS L11212-11219).
- `SessionUsage.rateLimits`: "The rate-limit windows the last API response reported (`five_hour`, `seven_day`, a gateway's `spend_limit`); empty when none has a reading." (DTS L11641-11644).
- `SessionRateLimit` has no dollar or period field (DTS L11206-11220). So a mod gets the percent and the reset time only, never `used_usd`, `limit_usd` or `period`.

### 3.2 The binary maps the `overage` headers to `spend_limit` only on the gateway provider

- **Headers read.** The client parses four windows from `anthropic-ratelimit-unified-<suffix>-utilization`, `-reset` and `-surpassed-threshold`. The windows are `five_hour` (`5h`), `seven_day` (`7d`), `seven_day_overage_included` (`7d_oi`) and `overage` (`overage`) (BIN L486375: `var jv=[["five_hour","5h"],["seven_day","7d"],["seven_day_overage_included","7d_oi"],["overage","overage"]]` and `function TDn(e)`).
- **Mod API.** `$.session.usage()` builds `rateLimits` like this (BIN L487861):

  ```js
  function LHt(e,n){let r=n==="gateway"?e.overage:void 0;return[...e.five_hour?[pue("five_hour",e.five_hour)]:[],...e.seven_day?[pue("seven_day",e.seven_day)]:[],...r?[pue("spend_limit",r)]:[]]}
  ... rateLimits:LHt(n.windows,n.provider) ... provider:Ie()
  ```

  `pue` sets `percentUsed` from the header's utilization fraction and `resetsAt` from its Unix reset (`resetsAt:new Date(n.resets_at*bY).toISOString()`). The `overage` window becomes `spend_limit` only when the provider is `"gateway"`. On any other provider it is dropped, even when the server sends `overage` headers.
- **Status line.** The status line input follows the same rule: `...Ie()==="gateway"&&st.overage&&{spend_limit:{used_percentage:..., resets_at:..., ...used_usd, limit_usd, period}}` (BIN L487861). It drops a window whose reset is past, or more than a year ahead (BIN L486375: `function Ent(e,n){... e.resets_at>r&&e.resets_at<s}`, with `s=r+31536000`).
- **Provider.** `function Ie(){if(co()||NQt()||$Qt())return"gateway";return a.CLAUDE_CODE_USE_BEDROCK?"bedrock":...:"firstParty"}`, and the display name for `gateway` is `"Cloud gateway"` (BIN L479082). A claude.ai plan sign-in and an Anthropic API key both resolve to `firstParty`. **Inferred** from the env-var chain: `co()` is the stored gateway sign-in. Its body was not traced.

### 3.3 Official docs: gateway only

- Status line field table: "`rate_limits.spend_limit.used_percentage`, `rate_limits.spend_limit.resets_at`: Behind a Claude apps gateway, how much of your spend limit you have used and when its period resets … Requires Claude Code v2.1.251 or later" (CC:statusline L197). `used_usd`, `limit_usd` and `period` need v2.1.284 or later on both Claude Code and the gateway (CC:statusline L198).
- Presence: "`rate_limits`: appears only for claude.ai Pro and Max subscribers, or behind a Claude apps gateway that sets a spend limit for you … Each window (`five_hour`, `seven_day`, `spend_limit`) may be independently absent" (CC:statusline L345). The schema embedded in the binary says the same: "`spend_limit`: Optional: behind a Claude gateway, your fullest spend limit" (BIN L488200).
- Spend limit fields: "Behind a Claude apps gateway with spend limits, the `rate_limits.spend_limit` object describes the spend limit that applies to you." `period` is "one of `daily`, `weekly`, or `monthly`". The dollar amounts are fetched about every five minutes and can trail the percent (CC:statusline L380-385).
- **The product exists.** "Claude apps gateway is a self-hosted service that sits between your developers' Claude Code clients and your model provider." It ships inside the `claude` binary and runs as `claude gateway --config gateway.yaml` (CC:claude-apps-gateway L13-15). Developers "don't need a claude.ai account, an API key, or a subscription" (CC:claude-apps-gateway L254). Sign-in uses `/login` on the **Cloud gateway** screen, configured through MDM-pushed `forceLoginMethod: "gateway"` and `forceLoginGatewayUrl`. "A developer can't set this up manually." (CC:claude-apps-gateway L248, L276-288).

### 3.4 What the gateway spend limit is

- **Purpose.** "Spend limits cap how much each developer can spend through your Claude apps gateway in a given day, week, or month. When a developer passes their cap, the gateway returns `429` …" (CC:claude-apps-gateway-spend-limits L9).
- **Scope.** A cap's scope is `user`, `rbac_group` or `organization`. "A group or organization cap is a per-seat default that each member inherits, not a shared pool." A developer's effective cap, per period, is the per-user override, then the strictest group cap, then the org default, then unlimited (L37-41).
- **Period.** `daily`, `weekly` or `monthly`. "A scope can hold one cap per period, and each enforces independently" (L39). "Caps reset on UTC calendar boundaries: daily at 00:00 UTC, weekly on Monday, and monthly on the first." (L58). In the gateway's own code, `period` defaults to `"monthly"` (BIN L505566: `period:Ic(["daily","weekly","monthly"]).default("monthly")`).
- **Which cap the window shows.** "When several caps apply it describes the fullest one, or once blocked the one that resets last." (gateway protocol doc served by the gateway, BIN L505738-505790, "Usage-limit headers").
- **What is counted.** After each response, a meter prices the token counts at list price and adds the cost to the daily, weekly and monthly counters. "The amounts are USD estimates, a circuit breaker rather than an invoice" (CC:claude-apps-gateway-spend-limits L60-73). "The spend a developer sees is the gateway's own estimate … and not an amount from your provider's bill." (L95).
- **Wire format.** The gateway sends the same `anthropic-ratelimit-unified-*` headers that api.anthropic.com sends subscribers. It sets `representative-claim: overage` and puts the cap in `overage-utilization` and `overage-reset`. It strips the upstream's own rate-limit headers, "otherwise your org-wide quota reaches users as if it were theirs. Send none of these for a user with no cap." (BIN L505738-505760; CC:claude-apps-gateway-spend-limits L93). This is the `overage` window that §3.2 renames to `spend_limit`.

### 3.5 Plan extra usage is a different thing that Claude Code does not report as a window

- Extra usage, now called usage credits, lets Pro, Max 5x and Max 20x subscribers keep going after their included limits. It is billed separately "at standard API rates", with an optional monthly spend cap ("Set a maximum amount you're willing to spend on usage credits each month") (HC).
- In Claude Code, plan usage-credit spend appears as a `/usage` row. "Pro and Max: your spend for the current month, measured against your monthly spend limit". "Team and Enterprise: your own spend for the current month, measured against any limit your organization set" (CC:costs L68-75). That row is drawn from a separate request, not from a rate-limit window.
- The client knows about plan spend caps: the monthly `overage_spend_limit` endpoint, "Increased monthly spend limit to …", and Team or Enterprise `org_spend_cap_reached` messages (BIN L486970, L514952, L499468). None of these reach `rateLimits`, because of the provider check in §3.2.

## 4. Unverified, and how to check live

- **Whether a plan response carries `anthropic-ratelimit-unified-overage-*` headers.** Not checked. It does not change the answer: on `firstParty` the client drops the `overage` window either way (§3.2).
- **The gateway case end to end.** Not run on this machine. To check, start `claude gateway --config gateway.yaml` on loopback with Postgres and an `admin:` block. `POST /v1/organizations/spend_limits` a small user cap (`period: "monthly"`), sign in with `/login` through managed settings, send a prompt, then log `$.session.usage().rateLimits` from a mod. Expected: a single `{kind: "spend_limit", percentUsed, resetsAt: <1st of next month 00:00 UTC>}`, and no `five_hour` or `seven_day`.
- **Plan case.** On this Max account, log `$.session.usage().rateLimits` after a prompt. Expected: `five_hour` and `seven_day` only, even with usage credits on and a monthly spend limit set.
- **Version drift.** The provider check is in 2.1.292. The docs mark the whole surface as early access (DTS L4), so re-check on upgrade by grepping the binary for `pue("spend_limit"`.

## 5. Implication for ctui

### 5.1 Overlap on a plan

- **There is no overlap on a plan** (inferred from §3.2 and §3.3). On a Pro, Max, Team or Enterprise plan, `rateLimits` holds at most `five_hour` and `seven_day`, so `limits` never draws a `spend` row there. With `limits_cost` set to `on`, the month cost row is the only dollar figure, and #149's question does not come up on a plan.
- The month cost row and plan usage credits are still different things, but ctui cannot see the second. The row counts all Claude Code spend on this computer at API prices. Usage credits count only the spend beyond the included limits, across claude.ai and Claude Code on every device (HC). That difference belongs in the row's description, not in a merge with `spend`.

### 5.2 The gateway case, which the map does not cover yet

- **Detection.** A gateway developer gets `rateLimits = [spend_limit]` and no `five_hour` or `seven_day` (§3.2, §3.4). So "Plan = `usage.rateLimits` non-empty" (#144) counts a gateway sign-in as a plan, and `auto` would hide the cost row there. Keying on `five_hour` or `seven_day` being present, rather than on any window, would tell the cases apart (**inferred**). The ctui type comment "empty off a subscription" (`ctui/types/index.d.ts` L26) is wrong for the gateway in the same way.
- **Overlap behind a gateway.** If the admin's cap is `monthly`, `spend` and the month cost row measure close to the same thing, but they are not the same:
  - `spend` is the gateway's estimate for this developer across every machine and client that uses the gateway. Its month runs from the 1st 00:00 UTC.
  - The month row counts this computer only, priced by Claude Code, from the 1st 00:00 local time.
  - If the cap is `daily` or `weekly`, the two have different periods and do not overlap.
- **No dollars for ctui.** A mod only gets `percentUsed` and `resetsAt` for `spend` (§3.1). ctui cannot show the gateway's `$used of $limit` or `period`, and cannot read the period from the data. The `resetsAt` gap (about a day, about a week, or the 1st) is the only clue (**inferred**).
