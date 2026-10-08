# Where ctui can read every session's cost this month (Claude Code 2.1.292)

Scope: issue #145. Which sources on this machine let ctui total the calendar-month cost of every Claude Code session, including sessions where ctui did not run. Each claim cites a primary source. **Inferred** marks what the sources imply without stating it outright, and **Unverified** marks what needs a live check.

**Source keys**

- **DTS Ln**: `vendor/claude-code-types/claude-code/index.d.ts`, the types the engine ships for 2.1.292 (MEMORY.md, "One pinned Claude Code version").
- **BIN @n**: the bundled engine JavaScript in `node_modules/@anthropic-ai/claude-code/bin/claude.exe` (2.1.292), at byte offset `n`. To reproduce, read the file in Python and print `d[n-300:n+300]`.
- **DISK**: read-only scans of `~/.claude/` and `~/.claude.json` on the author's machine, on 2026-10-08. Only field names, counts and sizes are recorded here.

## 1. Answer

Use the **`cost-state` entries in the session transcripts** (`~/.claude/projects/<project>/<sessionId>.jsonl`). Claude Code writes the session's own USD total there, subagents included. Take the last entry per `sessionId`, add up those that fall in the month, leave out the current session's entry, and add the live `$.session.usage().cost.usd`.

Two gaps remain:

- **Other sessions that are still running** have no `cost-state` on disk until they `/clear`, resume another session, or exit.
- **`claude -p` / SDK runs** never write one. Here they hold about 1.6% of output tokens.

| Source | USD or tokens | Reachable from a mod | Covers sessions without ctui | Verdict |
|---|---|---|---|---|
| `cost-state` lines in main transcripts | **USD**, total and per model | Yes: `$.fs` takes absolute paths, `$.process.run` for files over 4 MiB | Yes, for interactive sessions that ended or cleared | **Recommended** |
| `assistant` rows' `message.usage` in transcripts (main and `subagents/`) | Tokens only | Same as above | Yes, every session, `-p` included | Fallback for `-p` runs only. Needs a pricing table ctui would have to bundle |
| `~/.claude.json` `projects[<path>].lastCost` / `lastModelUsage` | USD | Yes (absolute path) | Only the **last** session per project | Not enough for a month |
| `$.session.usage().cost` / `session.measure` | USD | Yes | Current session only | Use it for the live part |
| ctui's `$.store` | Whatever ctui writes | Yes | No: only sessions ctui ran in | Only for sharing live costs between concurrent ctui sessions |
| `~/.claude/sessions/<pid>.json` | No cost | Yes | Lists live sessions | Shows which sessions are live, not what they cost |

## 2. The `cost-state` transcript entry

### 2.1 Shape (USD, not just tokens)

- The engine's schema is `{type:"cost-state", sessionId, totalCostUSD, totalAPIDuration, totalAPIDurationWithoutRetries, totalToolDuration, totalLinesAdded, totalLinesRemoved, totalDuration, startTime, modelUsage: {<model>: {inputTokens, outputTokens, thinkingTokens?, ...}}, ...}` (BIN @211576216).
- It is built from the session's cost ledger: `totalCostUSD: Dh()` (BIN @211867959). The same ledger feeds `$.session.usage().cost`, which is "US dollars, summed over every priced API response this session" and "as /cost totals it" (DTS L10901-10909, L11646-11650). **Inferred**: both figures come from one ledger, so the live and stored numbers use the same pricing.
- DISK: all 660 `cost-state` lines carry exactly `type, sessionId, totalCostUSD, totalAPIDuration, totalAPIDurationWithoutRetries, totalToolDuration, totalLinesAdded, totalLinesRemoved, totalDuration, startTime, modelUsage, hasUnknownModelCost`. `startTime` is epoch milliseconds (an integer). Each `modelUsage` value has `inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens, thinkingTokens, webSearchRequests, costUSD`. No line has `hasUnknownModelCost: true`. The line has **no timestamp**.
- Subagents are included. DISK: in 105 of 553 sessions with subagents, the `cost-state` output-token total equals the main transcript's deduplicated output tokens plus the `subagents/*.jsonl` ones exactly. No `subagents/` file holds a `cost-state` line. So read main transcripts only, and nothing is double counted.

### 2.2 When it is written

- `g_t()` appends `cost-state` to the transcript and writes `lastCost` and the other `last*` fields to `~/.claude.json` (BIN @211868975). It is called:
  - on a conversation reset such as `/clear` (BIN @232630848, and the saver at BIN @225140805),
  - when the session switches to another conversation (resume or fork, BIN @232338221),
  - when the interactive UI tears down at exit (BIN @233756654).
- The `process.on("exit")` fallback writes only `~/.claude.json`, not the transcript (BIN @233756654). **Inferred**: a session that is killed or crashes gets no `cost-state`.
- Resuming reads it back: the transcript loader keeps the **last** `cost-state` per session (`"cost-state":"last-wins"`, BIN @215884269, @215887796) and restores it as `costState` (BIN @216046597, @215996860). `SessionUsage.startedAt` is the first launch for a resumed session, "so what happened while a resumed or continued session was away still counts as its own" (DTS L11624-11637).
- DISK: 487 of 553 transcripts with a `cost-state` have one entry, and the rest have 2 to 11. Within each file `totalCostUSD` never decreases (553 of 553), so it is cumulative. 540 of 553 have it on the last line.

### 2.3 Gaps

- **`-p` / SDK runs.** DISK: 193 main transcripts with assistant turns have no `cost-state`: 189 with `entrypoint: "sdk-cli"`, 2 `cli` (both live now), 2 `claude-desktop`. They are short (median 6 assistant rows) and hold 246k of 15.7M main-thread output tokens (about 1.6%). Interactive `cli` and `bg` sessions write one.
- **Live sessions** have none until one of the triggers in 2.2 fires.
- **Retention.** `cleanupPeriodDays` is the "number of days to retain chat transcripts before automatic cleanup (default: 30)" (BIN @204303216). A calendar month is up to 31 days, so on the 31st, sessions from the 1st may already be gone. **Inferred**: caching each ended session's total in ctui's `$.store` closes that edge. DISK: the oldest transcript here was last written 2026-09-17, and `settings.json` sets no `cleanupPeriodDays`.

## 3. Token-only fallback (`assistant` rows)

- DISK: each `assistant` row has `message.model` and `message.usage` with `input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, cache_creation, service_tier, inference_geo`, and sometimes `server_tool_use, speed, iterations, output_tokens_details, fallback_credit`, plus `timestamp`. There is no USD field. The only top-level cost-like fields in any transcript are `cost-state`'s `totalCostUSD` and `hasUnknownModelCost`.
- **Duplicated rows.** DISK: 65,584 assistant rows, but only 30,274 unique `(message.id, requestId)` pairs. A response is split over several rows that each repeat the usage. Deduplicate by that pair, or the total roughly doubles.
- **Pricing.** The mod API exposes no price table. Claude Code prices internally with "the managed modelPricing when set, otherwise list price" (DTS L7770-7776), but that is not readable from a mod. ctui would have to bundle a per-model table (input, output, cache read, cache write at 5m and 1h, plus `speed`, `service_tier` and web-search surcharges). Keeping it current would mean a ctui release per price or model change, because ctui makes no network calls (MEMORY.md, "The `versions` footer shows no update icon; the mod makes no network call"). Models seen here: `claude-opus-5-5`, `claude-opus-5`, `claude-fable-5-1`, `claude-sonnet-5-5`, `claude-sonnet-5`, `claude-haiku-4-5-20251001`, `<synthetic>`.
- What this would buy: the `-p` sessions (about 1.6% here) and an exact per-day split for a session that crosses midnight on the 1st, because rows carry `timestamp`.

## 4. Other Claude Code files

- **`~/.claude.json`** (outside `~/.claude/`). `projects[<path>]` has `lastCost, lastModelUsage{<model>:{costUSD, inputTokens, ...}}, lastSessionId, lastDuration, lastAPIDuration, lastTotal*Tokens, lastSessionMetrics`. That is one session per project, overwritten by the next (BIN @211868975, `kxe`). DISK: 16 projects. It can't total a month.
- **`~/.claude/sessions/<pid>.json`**: `pid, sessionId, cwd, startedAt, status, updatedAt, kind, entrypoint, ...`, with no cost. DISK: 6 files. It shows which sessions are live, so a reader knows whose cost is missing.
- **`~/.claude/history.jsonl`** (450 KiB): prompt history, no cost. Skip.
- **`~/.claude/plugins/store/<plugin>-<hash>.json`**: one JSON file per plugin's `$.store` (DISK: two such files, from other plugins). See section 6.

## 5. Reaching the files from a mod

- `$.fs` is "the file system as the engine's own process reaches it". A relative path resolves under the working directory, "an absolute path is used as given; where one may go is an `fs.*` hook's to say" (DTS L3187-3193). So paths outside the cwd work unless some plugin's `fs.*` hook denies them.
- Find the home directory with `$.env.get("HOME")` (DTS L3568). The module must spell the name as a literal. **Unverified**: whether a `CLAUDE_CONFIG_DIR` override moves `projects/`, and so whether ctui should read that variable too.
- `$.fs.list(dir)` gives `{name, kind, size, mtimeMs, isLink}` per entry (DTS L3223-3235), enough to skip files last written before the month began.
- **`$.fs.read` rejects files over 4 MiB** (DTS L3191-3193, L3197-3201). DISK: 19 of 945 main transcripts exceed 4 MiB (largest 18.9 MiB, median 185 KiB). All 19 hold a `cost-state`, and they are the biggest sessions, so they can't be skipped.
- `$.process.run(argv)` (CLI only) runs a command without a shell and returns up to 4 MiB of stdout, with a 30 s default timeout (DTS L3465-3487). `grep -h -F '"type":"cost-state"' <paths>` returns just those lines from files of any size.

## 6. Size and scan time

- DISK, `~/.claude/projects/`: 1.1 GiB in all, 2,559 `.jsonl` files (945 main transcripts, 1,614 under `subagents/`), 219,580 lines.
- This month (written since 2026-10-01): 2,217 files and 641 MiB including subagents. September: 342 files, 311 MiB.
- Timings, warm page cache:
  - `grep -h -F '"type":"cost-state"'` over this month's main transcripts: 0.09 s, 459 lines, 254 KiB.
  - A full JSON parse of every line of every transcript in Python: 4.4 s.
- **Inferred**: cost-state lines are about 560 bytes each, so a month's grep output stays far below `$.process.run`'s 4 MiB stdout cap. A cold cache will be slower. **Unverified**: the time on a cold cache, and inside the mod's runtime.
- An incremental option: keep `{path → size, mtimeMs, last cost-state}` in `$.store` and re-grep only changed files. That also keeps totals past the 30-day sweep.

## 7. Joining the live session without double counting

- `$.session.id()` is "the session's id (the transcript file's name)" (DTS L2765-2768), and it matches `cost-state.sessionId`. DISK: 553 of 553 match the file name, and no `sessionId` appears in two files.
- `month = Σ last cost-state.totalCostUSD over sessions in the month, sessionId ≠ current + $.session.usage().cost.usd`.
  - **Leave out the current session's stored entry.** After a resume, the live ledger is restored from it (2.2), so adding both counts it twice.
  - After `/clear` the session gets a new id, and the old one's `cost-state` is written at the reset (BIN @232630848). So the old cost moves from "live" to "stored" with nothing lost or counted twice. **Unverified**: whether `$.session.usage().cost` and `$.session.id()` switch at once, or whether a render can see the new id with the old cost.
  - `session.measure` pushes the live figures when "the total grew" (DTS L4375-4385, L11019-11045), so ctui need not poll.
- **Month attribution.** `cost-state` has only `startTime` and a cumulative total, with no per-day split. A session that crosses midnight into the 1st counts entirely in one month, either the month it started (by `startTime`) or the one it was last written in (by file `mtimeMs`). An exact split needs the token fallback in section 3.

## 8. Concurrent sessions

- A second interactive session that is still running has written no `cost-state`, so its spend so far is missing until it ends or clears. `~/.claude/sessions/<pid>.json` can show that such sessions exist.
- If each ctui session publishes its live `cost.usd` under its `sessionId` (on `session.measure`), every ctui reader can add `max(stored, published)` per session. This covers concurrent sessions that run ctui, but not ones that don't.
- `$.store` is "a JSON file of the plugin's own under the user's Claude Code configuration directory" (DTS L3317-3322), one file shared by every session of the plugin (DISK: `~/.claude/plugins/store/<plugin>-<hash>.json`). **Unverified**: whether two processes calling `$.store.set` on different keys can lose each other's writes. A per-session file through `$.fs.write` (DTS L3216-3221) avoids the question.
- Ended sessions don't race: each transcript is written by its own session, and a reader only greps.

## 9. Recommendation

1. Source of record: `cost-state` lines from `~/.claude/projects/*/*.jsonl`, main transcripts only. List the files with `$.fs.list` and filter by `mtimeMs` ≥ the month start, extract with `$.process.run(["grep", "-h", "-F", '"type":"cost-state"', ...paths])`, and keep the last line per `sessionId`. Attribute by `startTime`, and skip the current `sessionId`.
2. Add `$.session.usage().cost.usd`, refreshed on `session.measure`.
3. Accept the gaps (live sessions elsewhere, `-p` runs, crashed sessions), or label the total "ended sessions + this one". Bundling a pricing table for the `-p` runs isn't worth it at about 1.6% of tokens, given the network-free rule.
4. Optional later: cache per-session totals in `$.store` to survive the 30-day sweep and to avoid re-reading files, and publish live per-session costs for concurrent ctui sessions.
