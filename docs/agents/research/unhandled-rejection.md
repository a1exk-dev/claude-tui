# What an unhandled rejection does to ctui's hooks module (Claude Code 2.1.300)

Scope: the measurement [#455](https://github.com/a1exk-dev/claude-tui/issues/455) that [#442](https://github.com/a1exk-dev/claude-tui/issues/442) waits on — whether a rejection escaping a bare `void f($)` call is survivable, and so whether ctui's 11 bare calls or its 20 inline `.catch(() => undefined)` calls are the right house idiom.

**This branch is throwaway.** It is never merged: `tests/rejection-probe.test.tsx` fails `node scripts/check.ts` by design, because raising the rejection is the whole point of it.

**Engine**: every claim below is read against **Claude Code 2.1.300**, the pin in `package.json`, which is the version `claude plugin test` runs. `MEMORY.md`'s "Engine-pinned expectations hold only on the pinned Claude Code version" applies to all of it.

**Method**: a scenario test boots `register.tsx` with the Sidebar docked and the `todo` section on, over a `state.set` hook beneath the plugin that denies one key by name and passes every other on (#452's pattern), with `mock.clock` driving the 1 s tick. Two files, so that "the file ran to its end" — the kit's per-file verdict — is read separately for the denied and the clean case:

- `tests/rejection-probe.test.tsx` — `versions` denied (the tick's bare `void refillVersions($, config.theme)`, which never caches, so it retries and rejects on every tick) and `todo` denied (the bare `void loadTodo($)` in both task hooks).
- `tests/rejection-control.test.tsx` — the same scenario with nothing denied.

Reproduce with the runner in the ticket, or by copying both files into a staged `ctui/tests/` and running `claude plugin test` on it. Counts below were stable across three runs.

## 1. The module survives it

With `versions` denied, the tick's bare call rejects on every tick, and nothing stops:

| Observation | Result |
|---|---|
| Does the **next** tick run? | **Yes.** Attempted `versions` writes after ticks 1, 2 and 3: 3 → 4 → 5, one per tick. The interval is not cancelled. |
| Does a later hook still fire? | **Yes.** A `TaskCreate` after three rejecting ticks still went through ctui's `tool.call` hook and answered `{ result }` alone — ctui's own-call shape, so `hidesList` was still live. |
| Does the Sidebar still redraw? | **Yes.** `pane.redraw()` after the rejections drew its rows as before. |
| Is anything said in the transcript or a toast? | **No.** `ui.toast` and `ui.log` were never called, and nothing was appended. |

The typings' documented unload paths (`engine.create` failure; `model.complete` answering `aborted` when "the plugin's environment unloaded") were not reached. Nothing user-visible happened at all.

## 2. No difference between a hook body and the tick callback

With `todo` denied, `void loadTodo($)` rejects after the task hook has already returned its answer. The first `TaskCreate` answered correctly, the **second** `TaskCreate` was still hooked and answered correctly, the tick kept running, and again no toast and no log. Identical to the tick-callback case on every count.

So the distinction the ticket drew — a hook body's bare `void` sits inside a hook's lifetime, the tick callback's sits outside any — makes no observable difference at 2.1.300. Neither site's rejection can fail a hook, and neither takes anything down.

## 3. Whether the test kit can be trusted for this — read both halves

**The kit does not swallow it.** It catches every unhandled rejection in a file and fails a synthetic final test, `the file ran to its end`, listing each one by its engine text:

```
(fail) the file ran to its end
  a rejection nothing handled: ctui: $.state.set: refused versions
  ctui: $.state.set: refused versions          (×3 more)
  ctui: $.state.set: refused todo              (×4)
```

`tests/rejection-control.test.tsx`, in the same run with nothing denied, has no such failure. So the verdict is specific to the unhandled rejection, not noise from the scenario.

The report also attributes precisely. Five `versions` writes were attempted but **four** rejections were reported, and the fifth is the render hook's `$.clock.after(0, () => void refillVersions($, config.theme).catch(() => undefined))` — the one site of the five that is `.catch`-guarded. The guarded call produced no unhandled rejection; every bare one did. Nothing was dropped.

**But the kit cannot answer the engine question.** This is the kit's own instrumentation, not an engine behaviour, and a control that raises an unhandled rejection from outside ctui could not be built: the kit refuses `$.clock.every` called from a test's own hooks — `test: $.clock.every refused: its hooks module does not call it (host rule; the scan lists no calls)` — so there is no way to separate what the kit does from what the engine does. **What is measured is that nothing in the module's own lifetime stops. Whether a real interactive session's plugin environment also survives an unhandled rejection is not established here**, and neither the 2.1.309 plugin-authoring reference nor the 2.1.300 typings tie a rejection to an unload. Treat the survival finding as holding in the kit, unmeasured in a live session.

## 4. The fact the policy turns on

Independent of the engine question, and the one cost that does not need it: **a bare `void` whose promise rejects fails `node scripts/check.ts`.** The failure is per-file, so any scenario test that exercises a failure path reaching a bare `void` call fails the whole file, however the assertions in it fare — all three of this probe's own behavioural tests passed, and the file still failed. A guarded call's rejection fails nothing.

So the bare idiom is not testable against failure, and the deviation ctui already carries — the inline `.catch(() => undefined)` — is what lets a failure path be asserted at all. That is a property of ctui's own test mechanism, not an engine-pinned expectation, so it does not expire with the pin.
