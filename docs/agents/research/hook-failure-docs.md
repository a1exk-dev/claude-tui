# What Claude Code's own docs prescribe for a failed engine call in a hook

Scope: [#457](https://github.com/a1exk-dev/claude-tui/issues/457), the reading [#442](https://github.com/a1exk-dev/claude-tui/issues/442) waits on. #442 is choosing between one rule per position (a timer callback, a hook's boot path, after a `next` was answered) and one rule everywhere for ctui's ~21 bare `void f($)` calls and ~20 inline `.catch(() => undefined)` calls in `ctui/hooks/register.tsx`. The human's call was to take the shape from the engine's own documented practice rather than invent one.

**This branch is throwaway.** It holds this file and is never merged.

## Sources, and which engine version each is

| Source | Version it speaks for |
|---|---|
| `vendor/claude-code-types/claude-code/index.d.ts` | **Claude Code 2.1.300** — its own first line, `// Written by Claude Code 2.1.300.` This is the repo pin (`package.json` devDependencies `@anthropic-ai/claude-code`). |
| `ctui/.claude-plugin/types/claude-code/index.d.ts` | **2.1.300**, and **byte-identical** to the vendored copy above (`diff -q` reports no difference). Reading one reads both. |
| `vendor/claude-code-types-floor/claude-code/index.d.ts` | **2.1.292**, the Support floor — `// Written by Claude Code 2.1.292.` |
| The official mods documentation, `https://code.claude.com/docs/en/plugins/mods/*.md` (overview, create, reference, interface, events, api, test, troubleshoot, admin), fetched 2026-10-24 | The reference page states it covers **v2.1.287**; the prose carries per-version notes (`requires Claude Code v2.1.292 or later`) where behaviour moved. |
| The bundled guard's **source**, `mods/sec-default/` in the public `anthropics/claude-code` repository (tarball of `main`, commit `30fa83c`, fetched 2026-10-24) | `main` at fetch time, not necessarily what 2.1.300 ships. |

On the guard: the ticket allowed for having to read build artefacts out of the binary. That was not needed and is not what was read. The on-disk 2.1.300 package is one 267 MB `bin/claude.exe` with no readable mod in it, but the admin page states **"The guard's source is public in the `mods/sec-default` directory of the Claude Code repository"**, and it is — ~110 TypeScript files with doc comments, written by the engine's own authors. Everything in §5 is read from that source. Its version caveat is the one above: `main` may lead the shipped 2.1.300 build, so treat it as the authors' current practice rather than as a measurement of the pin.

Claims below say *where* they come from and *what that source asserts*; nothing is cited by line number.

---

## 1. The idiom: where the typings write `.catch(() => undefined)`

**Where it appears.** In the whole 2.1.300 typings file, `.catch(() => undefined)` is written in exactly **three** places, and all three are in `$.fs.stat`'s `@example` blocks: once in the Read guard that resolves `e.file_path` and denies what falls outside `ROOT`, and twice in the `placed()` helper of the Write guard, which stats the file and then its folder. There is no fourth site. No other `$` noun's examples use it — not `$.store`, not `$.state`, not `$.config`, not `$.ui`.

**It is the idiom for a decided substitute, not a silencer.** In all three the awaited result is immediately read for a decision, and `undefined` is the answer the guard is written to act on: `$.fs.stat`'s own doc comment says it **"Rejects when missing"** and that `realPath` is **"absent when it leads nowhere"**, and the example's comment explains that the guard **"denies on undefined or outside ROOT"**. So the handler is there because the call's rejection is one of the call's documented outcomes and the code has to turn it into a value it can branch on. That is not example noise: delete the `.catch` and the examples' stated behaviour (deny on unresolvable) is gone. It is also not a general "survivable failure" idiom — it is specific to *an awaited call whose rejection the next line has to decide from*.

**What the typings prescribe for a bare un-awaited call: a bare `void`, no handler.** The same file's examples write un-awaited calls three times, and every one of them is bare:

- `void $.prompt.submit({ text: "List the TODOs you just mentioned." })` in `$.prompt.submit`'s example
- `void $.prompt.suggest({ text: "run the tests you just wrote" })` in `$.prompt.suggest`'s example
- `if (e.viewport?.isFullscreen === true) void $.ui.open({ id })` in the `isFullscreen` viewport field's example

None carries `.catch`. So on the typings' own showing the two shapes are not alternatives for one situation: the awaited-and-decided-from call gets `.catch(() => <substitute>)`, the fire-and-forget call gets a bare `void`.

**Why those three can be bare, and the line it draws.** Each call's own doc comment says whether a refusal **resolves** or **rejects**, and the bare-`void` examples sit on calls whose ordinary refusal is a resolution: `$.ui.open` **"says if it is drawn"** and `@returns` `{ isPlaced: true }` or `{ isPlaced: false, reason }` — including when **"a `ui.open` hook may refuse"**; the api page's table of refused calls lists `$.prompt.submit` as **"Resolves with `{ drop: '<reason>' }` and queues no prompt"** while `$.command.run` **"Rejects with an error whose message ends with `<reason>`"**. Calls documented to reject are handled in the docs' examples: `$.config.set` **"Rejects a key no row has"** and its example reads `{ deny }` off an `await`; `$.telemetry.log` **"rejects when one denies"** and its example awaits it; `$.process.run` **"rejects if the program can't start or is still running at the timeout … so wrap it in `try` and `catch`"**; `$.ui.notify` **"rejects instead of resolving when `text` isn't a string, when another mod's hook on `ui.notify` returns `{ deny }`, or when writing to the terminal fails"**. Note `$.ui.log`, `$.ui.toast`, `$.ui.status` and `$.ui.invalidate` are typed `=> void`, not `Promise`, so they are not floating promises at all and cannot be part of this question.

**Does any doc comment distinguish an un-awaited call from an awaited one?** Yes, four times, and each time awaiting is what buys something:

- `HookBudget`'s `ms` says each bound is the hook's **own** time and **"the clock stops while a `next(e)` call or any `$` call of the hook's is in flight (a `$.clock` wait excepted)"** — so awaiting a `$` call costs a hook no budget. This removes the usual reason to fire and forget inside a hook.
- `session.start`'s event comment says **"Observe. The first is awaited: a `$.tool.register` is listed by turn one"**, and its example is `on("session.start", ($, e, next) => $.tool.register(t).then(() => next(e)))` — awaiting is how the registration lands in time.
- The api page's retry example comments the opposite case in the code itself: **`// Not awaited: the hook would stay open until the new turn starts`**. Not awaiting is prescribed where awaiting would hold the hook open, which is the only reason it gives.
- That same example shows the shape for the un-awaited call: `submitPrompt($, text)` is called bare with no `.catch`, and `submitPrompt` is written with its own internal `try`/`catch` around `await $.prompt.submit({ text })` that reads `error?.message`. **The failure handling lives inside the function, so the call site needs none.** The page then generalises it: **"For a call that rejects, such as `$.command.run`, catch the error and test its message the way `submitPrompt` tests `reason`."**

---

## 2. The registration `.catch`: who earns one, and what happens without one

**Who earns one.** The typings' `EngineEventOf` carries the rule once, over the whole event table: a hook that fails is skipped, **"So a guard fails open unless its registration carries a `.catch` (Registration) that refuses in its place, at any event an answer refuses."** `Registration` repeats it from the other side: **"without it a failed hook is absent"**, and **"A guard carries one and refuses where `next` was not called."** It then recites a per-event recipe at each event where an answer refuses, each with the same `next.called` test:

| Event | Documented recipe |
|---|---|
| `tool.call` | "A guard that fails is skipped and the tool runs, so give it `.catch(($, e, next) => next.called ? next(e) : { deny: "no" })`" |
| `tool.check` | "A guard that fails is skipped, leaving the verdict beneath. **Nothing has run, so give it `.catch(() => ({ decision: "deny" }))`**" — the one recipe with no `next.called` test |
| `agent.offer` | `… next.called ? next(e) : { isOffered: false }` |
| `agent.spawn` | "A guard that fails is skipped and the subagent starts, so give it `… { deny: "no" }`" |
| `prompt.submit` | "a guard that fails lets the prompt through, unless given `… { drop: "no" }`" |
| `prompt.mention` | "A guard that fails is skipped and the file is read, so give it `… { deny: "no" }`" |
| `command.run` | "A guard that fails is skipped and the command runs, so give it `… { text: "no" }`" |
| `config.set` | "A guard that fails is skipped and the row is written, so give it `… { deny: "no" }`" |
| `plugin.register` | "A judge that fails is skipped and the module joins, so give it `… { refuse: "no" }`" |

The events page states the same set in prose and adds that at `tool.check` and `plugin.register` **"a refusal returned after `next` resolved still holds, so return it without testing `next.called`"**.

**Who does not.** Observe-only and rewrite-only events get no `.catch` remark and are documented as passing through instead: `agent.offer`'s neighbours `tool.describe` and `command.describe` say **"A hook that fails passes it through"**, `turn.complete` says **"A hook that fails leaves the answer as it was"**, `ui.focus` and the other UI events carry examples with no handler. So the documented trigger is **"does this hook's answer refuse something"**, not where in the module the hook sits.

**The full set of documented consequences of a throw with no `.catch`.** Collected from the events page's "Handle a hook that fails", `EngineEventOf`, `HookBudget`, `TraceOutcome` and the troubleshoot page:

1. **It is not the session.** The events page opens the section with **"A hook that fails doesn't break the session, and you can decide what happens instead"**; the troubleshoot page opens with **"When a mod's module or one of its hooks fails, Claude Code skips it and the session continues, so a broken mod can look like one that does nothing."**
2. **The hook's own answer is dropped, and which way depends on `next`.** Before `next` was called: **"Claude Code skips it, and the next handler runs in its place"** — `EngineEventOf` adds **"the hooks beneath and core run in its place"**. After `next` resolved: **"that result stands, and nothing runs a second time."** `TraceOutcome` names the two outcomes `skipped` and `kept`.
3. **Later hooks are untouched**; the chain runs beneath as if this hook were absent. Nothing in either source says a failure propagates along the chain or cancels the dispatch.
4. **The event still happens.** That is the whole point of "fails open": the tool runs, the prompt enters, the row is written.
5. **A deny/drop/refuse returned after `next` was answered is itself a failure of the hook**, and the `.catch` is then asked — `ConfigSetResult`: **"A deny after a `next(e)` was answered fails the hook: its `.catch` is asked (a deny from it fails too), or it is skipped by name and its last `next` stands"**; the same sentence is repeated on `AgentSpawnResult`'s `deny` and on `prompt.submit`'s `drop`. The events page gives the user-visible text for that case: the turn still runs and the hook fails **"with a message that includes `a drop after its next() was answered`"**.
6. **Three failure kinds, one treatment.** `HookFailure.kind` is `'throw' | 'timeout' | 're-entry'`; `throw` covers **"it threw, returned what the site refuses, or its hooks worker ended under it"**. The budget is `ms: 10_000` for a hook and `catchMs: 1_000` for the handler, and past the handler's grace **"the hook is absent as if it had no handler"**.
7. **The module keeps running.** Nothing in the 2.1.300 typings or the docs ties a hook throw, or a rejection, to the module being unloaded. The only documented unload-on-code-fault paths are other things entirely: `engine.create` **"fails, and its plugin unloads, when it REPLACES another's"** noun; the troubleshoot page's `it crashed the hooks worker` — **"A hook that blocks the thread, such as a loop that never awaits, is one cause"**, a blocked thread, not a rejection; and `mods that run in the hooks worker are off for this session: it crashed 3 times`, where Claude Code **"couldn't trace the stops to one mod"**. A failed `userConfig` validation stops the load before any hook runs.
8. **What the person sees: one line, and in ctui's case nowhere they look.** The events page: **"One line names the mod, the event, and the reason, such as `my-mod: tool.call hook skipped: threw Error: boom`"**, and the troubleshoot page's `hook skipped` entry adds **"The line appears once for each event and kind of failure until the mod reloads"**, with the debug log holding every occurrence. Where it lands is the part that matters here — the troubleshoot page lists it: a transcript line only in **"A session that hot-reloads a plugin directory … started with `--plugin-dir`"**; in **"Any other interactive session, such as one that runs a mod you installed from a marketplace"**, the **debug log only**, which needs `claude --debug`; under `claude -p --plugin-dir`, stderr. So for a ctui user who installed from the marketplace, a failing hook is invisible unless they run with `--debug`. Nothing says a failure raises a toast.

---

## 3. An unhandled rejection specifically

**The typings say nothing.** `$.clock.after` and `$.clock.every` are both typed `TimerCall`, which is `(ms: number, fn: () => void) => Timer` — the callback's return is `void`, so an async callback's promise is not in the type at all and no doc comment on either call, on `Timer`, or on the `clock` noun says what becomes of one. The `clock` noun's comment covers only identity and lifetime: **"A timer's callback is the plugin's own function, kept in its environment and run there when the wait resolves; a hot reload of the plugin cancels its pending waits with the old environment."** `$.clock.after` adds only that `fn` **"runs when it resolves, and never when a hook refuses it"**, and `$.clock.every` that **"a refused period ends the interval."** Searching the whole 2.1.300 file for `unhandled`, `rejection` outside `next.trace`'s `rejected` outcome, or any wording about a promise nobody awaits returns nothing. **On the typings alone this is an undocumented case.**

**The docs say exactly one thing, and it is the answer.** The api page's "Run work in the background" section ends its timer walkthrough with: **"The timer's callback runs outside any event, so it keeps running between turns and doesn't start one. If the callback throws, the error goes to the debug log and the timer runs again at the next interval."**

That sentence is worth its weight for three reasons:

- It is the **only** statement in either source about a failure in code the engine holds rather than awaits, and it prescribes nothing: no handler, no cancellation, no user-visible line. Debug log, and carry on.
- The example it describes is an **async callback with no handler of any kind** — `$.clock.every(60_000, async () => { const status = await $.process.run([...]); $.ui.status('checks: ' + summarize(status.stdout)) })` — and `$.process.run` is documented on the same page to **reject** if the program can't start or times out. So the only way that example's callback can "throw" is by rejecting, and the page states the consequence as survivable while showing the bare shape. That the page's word "throws" covers a rejection is **inference** from the example's own failure mode, not something the page spells out.
- It matches, from the engine's side, what #455 measured from ctui's side in the test kit: the module's next tick runs, later hooks fire, the Sidebar redraws, and nothing reaches a toast, `ui.log` or the transcript.

**What is still not documented:** whether an unhandled rejection from a hook body (as opposed to a timer callback) is treated the same, and whether a live session's plugin environment tolerates it as the test kit did. Both sources are silent. For #442's purposes this is an **accepted unknown with a documented default** — the one documented case says the engine logs it and keeps going — not a gap that needs a live measurement to close.

---

## 4. Per-position or uniform

**Neither. The documented guidance is keyed to the call and to the answer, and position never appears in it.** Nothing in the typings or the docs varies guidance by *where* a call sits. What varies is two other axes:

- **What the hook's answer does.** A hook whose answer refuses something earns a registration `.catch`; one that observes or rewrites does not (§2). This axis is an event-by-event property fixed by the engine, not a position in anyone's module.
- **What the call does when it fails.** Each call's doc comment states whether a refusal resolves as `{ deny }` / `{ isPlaced: false }` / `{ drop }` or **rejects**, and the examples handle the rejecting ones and leave the resolving ones bare (§1). This axis is per call.

The three positions #442 names are addressed only in passing and only by their consequences, never with a rule of their own:

- **After a `next` was answered** has a documented meaning, but it is about the hook's *return value*, not about a call inside it: a deny after `next` resolved fails the hook, which is why the `.catch` recipes test `next.called`. It says nothing about a failed `$` call.
- **A hook's boot path** gets one piece of concrete advice, on the api page, and it is ordering plus a local handler: `$.command.register` **"throws for a taken name … A hook that throws is skipped, so the rest of your `session.start` hook doesn't run either. Register commands last in that hook, or wrap the call in `try` and `catch`."** The reason given is entirely local — what else in that hook body does not run — and the troubleshoot page gives the same reason for `$.agent.register`: **"If that hook doesn't catch the rejection, it fails and Claude Code skips it."**
- **A timer callback** gets the sentence in §3, which makes it the most forgiving position of the three, not a position with its own idiom.

So the docs support a **uniform rule stated in terms of consequence**: handle a failure wherever dropping it would change what the mod answers or would skip work the rest of the hook needs; leave it where the failure costs the mod nothing. Applied to #442 that rule happens to fall out differently at different sites — a rejecting call awaited inside a hook body whose answer depends on it is handled, a fire-and-forget refresh is not — but the rule itself is one rule, and it is a rule about the call, not about its address.

---

## 5. The one comparable mod: `sec-default`

What the guard is, from the admin page: a built-in mod named **`sec-default@builtin`**, listed by `/plugin` as `cc-plugin-sec-default`, loaded **"ahead of every mod a user installs"**, which **"Users can't turn off"**. The events page's chain order puts it first, outermost. Its `register.ts` is 190 lines and hooks ~20 events. What it does at a failing engine call:

**Its stated policy is fail closed, twice over.** `register.ts`'s own doc comment on `register`: **"Three moves: continue past the user tier (`next.to(e, "append")`), refuse a user-tier caller or module by name, or pass. Provenance is the event's pinned `provider` or `tier`; policy is `$.settings.read`; fail closed."** Its README: **"both fail closed, so an unreadable policy counts as a policy in force"**, and **"It fails closed: when the read of managed settings is refused (a hook beneath denies it) or this plugin's hook fails, its `.catch` refuses the module … so a policy that cannot be read keeps every person's mod out at load."**

**Every promise-returning engine call it makes is awaited and carries an inline `.catch`, and the substitute is chosen, never blanket.** Its only such call is `$.settings.read(Policy.SOURCE)`, through a memo, and at each site the handler returns the conservative answer for that site:

- `tool.register`: `.catch(() => TOOL_REGISTER_REFUSAL)` — an unreadable policy **refuses** the registration.
- `tool.list`: `.catch(() => undefined)` — no policy means nothing is restored, which is the safe direction there.
- `tool.check`'s `.catch` handler: `await next(e).catch(() => undefined)`, then it decides from `undefined`.
- Its shared helper `decidedByPolicy` is `policy.then(decide).catch(() => true)`, whose doc comment is **"A yes/no read off managed policy that fails closed: true (protect) when the read rejects or deciding throws."**

So the guard does use ctui's inline shape — but the handler's value is load-bearing policy at every site, and `undefined` is used only where `undefined` is the safe answer. The memo deliberately does not swallow: its doc comment says it serves one read to every caller in the window **"rejections included (a failed read still fails closed)"**, and its own test asserts `rejects.toThrow` twice over.

**It carries a registration `.catch` on exactly its three gating hooks, and on nothing else.** `tool.check`, `env.set` and `plugin.register` have one; the ~17 observe-and-continue hooks (`classic.*`, the `prompt.*` family, `skill.prompt`, `session.append`'s doors, `settings.read`, `tool.describe`, `command.describe`, `agent.offer`, `agent.spawn`, `ui.log`, `env.get`) have none. `env.set`'s handler is the documented `next.called ? next(e) : <refusal>` shape verbatim; `tool.check`'s does not test `next.called`, exactly as the docs say for that event. This is the §2 rule applied with no deviation.

**It has no bare un-awaited promise call at all** — so it offers *no* precedent for the bare `void` idiom either way. Its only un-awaited calls are `$.ui.log(...)` in the `tool.check` hook and `$.ui.log(..., { to: 'debug' })` in the `plugin.register` handler, and `$.ui.log` is typed `(text, options?) => void`, not a promise. The guard never starts a timer and never calls `$.fs`, `$.http` or `$.process`.

**What it does make visible.** Its `plugin.register` handler's first act is `$.ui.log(admissionFailure(e.name, next.error), { to: 'debug' })` — the failure is named in the debug log, reading `next.error` for the kind, *and* the refusal is still returned. Its own test asserts the line: `debug: plugin.register hook failed judging mine (throw): …`. Its README states the user-facing half: the module is refused **"with the same line"** a policy-in-force refusal uses, so the person sees a refusal with a stable reason and the failure detail goes to the debug log.

**In one sentence:** the mod the engine's authors maintain awaits every call that can reject, handles each one inline with a substitute picked so the failure is safe, puts a registration `.catch` on its gating hooks and only those, writes the failure to the debug log where it had something to say, and never leaves a promise un-awaited.
