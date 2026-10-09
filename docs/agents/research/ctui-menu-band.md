# The `/ctui` menu in the AbovePrompt band (Claude Code 2.1.292)

Scope: issue #194. Could ctui draw the `/ctui` menu in the `AbovePrompt` band, directly above the prompt on both screen modes, instead of in a `$.ui.open` pane, the way Claude Code's own `/model` and `/config` take over the prompt? Today's pane menu is described in `MEMORY.md` ("`/ctui` is one instant menu; it survives each settings reload"). Every claim cites a source. **Confirmed** means the types or the bundled source settle it. **Live check** means it is inferred and the spike ticket must check it on 2.1.292.

**Source keys**

- **DTS**: `vendor/claude-code-types/claude-code/index.d.ts`, written by Claude Code 2.1.292 (line 1). Line numbers are for this file.
- **BUN**: the bundled source inside `node_modules/@anthropic-ai/claude-code/bin/claude.exe` (2.1.292, the repo's devDependency). The code is minified, so each citation gives a verbatim anchor to search for. To reproduce: `strings -n 8 claude.exe > strings.txt`, then search for the anchor. The band is the component `function mNe({survey:h,working:k,setInputValue:L,onHoldsBandChange:H})`, exported as `bS.AbovePromptSite`; "the band component" below means this function.
- **CC:interface**: `https://code.claude.com/docs/en/plugins/mods/interface.md`, fetched 2026-10-09.
- **MEM**: `MEMORY.md`, the entry named above.

## 1. Summary

| Question | Answer | Status |
|---|---|---|
| Can `/ctui` give the band the keys? | **No.** Only the person can: Ctrl+X Tab or a click. `$.ui.focus` is denied while the band doesn't hold the keys, and `autoFocus` lands only when the person gives the band the keys. Nothing in `$.ui` hands the band the keyboard. | Confirmed |
| Does focus stay while the person types? | Typing into a focused `Input` stays in the band. Any change to the composer's text drops the band's keys. | Confirmed (source); the fall-through of non-hotkey letters is a live check |
| Esc | Esc in the band is `abovePrompt:leave`: the keys go back to the prompt, the band stays drawn, and **no hook event fires**. ctui can't step back a level or close on Esc. | Confirmed |
| Reloads | The module swaps in one step and the old tree stays drawn until the new one answers. Focus survives because the elements stay ctui's. The ring keeps its **position** (index) and `autoFocus` doesn't re-land. | Confirmed (source); end-to-end is a live check |
| Surveys, other mods | While `hasSurvey` the band can't hold the keys, any hold is dropped, and digit hotkeys are off. Other mods share one `ui.render` chain: a mod above ctui that returns its own tree hides ctui's menu. | Confirmed |
| Size | Fullscreen: `maxRows` is what's left of a bottom slot capped at half the terminal, prompt included. Main screen: the terminal's height. A taller tree scrolls with one `↑ n more · ↓ n more` row. An open Select lists 8 options and gets extra rows on top of `maxRows`. | Confirmed (source); fit is a live check |
| Elements | Button, Input, Select and hotkeys use the same code in the band and in a pane. Two differences: Up/Down scroll instead of moving focus when the band overflows, and digit hotkeys also work from an empty composer. | Confirmed |

**Blocking engine limit.** On 2.1.292 a band menu can't take the keyboard when `/ctui` runs, and it can't see Esc. The person has to press Ctrl+X Tab (or click) after `/ctui` before any key reaches the menu. Esc then hands the keys back with no event, leaving the menu drawn and inert. The prompt's Esc (which interrupts a running reply) also comes back into play. A menu that takes over the prompt the way `/model` and `/config` do isn't reachable through the band. The pane is the only site that `/ctui` can focus, through `$.ui.open({ focus: true })`, and the only one whose Esc raises an event, `ui.close` with `closeOnEscape` (MEM; DTS L7350-7368).

## 2. Keys

### 2.1 Taking the keyboard

- **The person's chord or click.** The band "is focused by the person (a click, ctrl+x tab)" (DTS L10173-10174). A Button's site holds the keys "after ctrl+x tab, a click or `open({ focus })`: the band or its `Pane`" (DTS L1074-1075). `open({ focus })` applies only to panes.
  - BUN: the Chat bindings include `"ctrl+x tab":"abovePrompt:focus"` and `"ctrl+x ctrl+a":"abovePrompt:toggle"`. The handler `Ke("abovePrompt:focus",()=>{…},{context:"Chat"})` is the only keyboard path that sets the band's hold state. The other path is the band's `onClick:trn(()=>es(null))`. **Confirmed.**
- **`$.ui.focus` can't take it.** "The keyboard is the person's to give, so a site that does not hold it … is `{ deny }`" (DTS L13692-13696). The method moves the ring "while it holds the keys" (DTS L2516-2521).
  - BUN, the `ui.focus` core: `function mV(e){let n=hD(e);if(!n)return{deny:"no such site"};…if(!n.isHeldNow())return{deny:"that site does not hold the keyboard"};…}`. For the band, `isHeldNow` is `le(()=>He()!==null,[He])`, which is true only after the person's take. **Confirmed.**
- **`autoFocus` can't take it.** "The site's focus ring starts here when the site takes the keyboard … A pane opened with `focus`, or the person's focus chord or click, is the take" (DTS L1124-1131; Input L5465; Select L10434).
  - BUN, in `function eqo(e)`: the effect raises the auto move only `if(!h){…return}` is passed, that is, while the band is held. **Confirmed.**
- **No other API.** `$.ui` has `notice, invalidate, blit, resolve, log, ask, toast, status, open, close, panes, scroll, focus, copy, selection, complete, fork` (DTS L2323-2610). None of them gives the band the keys. **Confirmed.**
- **Mid-reply.** `abovePrompt:focus` is bound in the `Chat` context and its handler doesn't check `isWorking`, so Ctrl+X Tab should work during a turn. **Live check.**

### 2.2 What reaches the band without focus

- **Digit hotkeys from an empty composer.** "Never the composer, save that a bare digit in an empty one answers a band Button (a survey)" (DTS L1075-1076, L9326-9328).
  - BUN: `dp({inputValue:or,enabled:!h&&Lo.size>0,enterConfirms:!1,isValidDigit:(_n)=>/^[0-9]$/.test(_n)&&Lo.has(_n)&&_r(_n),onDigit:…L("")})`. A single digit typed into an empty composer presses the band Button with that hotkey after `Vte=400` ms, then clears the composer. This works only for digits, only while no survey is up, and only for a Button wholly inside the band's visible window (`Zte`; DTS L10195-10197). **Confirmed.**
  - This could drive a keyboard-less top level (`1: Plugins`, `2: Themes`) with no focus at all. It can't drive the Themes list, the Plugins rows, `x`/`k`/`j`, or the Monthly cost field.
- **`action` Buttons.** A Button's `action` names an engine keybinding whose chord presses it from the prompt. That holds only for "Chords, or a modified key Global or an active context binds … no dialog up and no engine handler of the action mounted" (DTS L1080-1086). Esc and plain letters don't qualify. **Confirmed (types).**

### 2.3 Keeping the keys

The band component drops its hold (`Ne(null)`) on each of these (BUN):

| Trigger | Anchor |
|---|---|
| The composer's text changes | `aoe(Or,Me??cs,Dn)`, where `Or=rp()` is the prompt-input store (`function rp(){return TL(Pr())}` beside `function w$()`, the composer value) |
| A survey starts or ends | `x(Dn,[h,Dn])` |
| No focusable elements and no scroll cue | `x(()=>{if(!rs)Ne(null)},[rs])`, where `rs=!h&&(gn.length>0\|\|eo)` |
| A pane takes the keys | `x(()=>{if(cs!==null)Ne(null)},[cs])` |
| The tree's elements all change to another plugin's | `x(()=>{if(eoe(ft.current,gn))Do(()=>0),Ne(null);…})`, where `eoe=(h,k)=>h.length>0&&k.length>0&&!k.some((L)=>h.some((H)=>H.plugin===L.plugin))` |
| The person collapses the band | `function kr(_n){k2t.set(_n),sn(_n),Ne(null)}` |
| Esc | `abovePrompt:leave` → `Hn.forget(),Ne(null)` |

- **Typing.** While an `Input` is focused, "every printable key reaches it alone and Esc returns them" (DTS L5437-5439). BUN `function r1(h)` appends to the focused Input's text.
  - With a Button focused, the band takes a key only if it is bound in the `AbovePrompt` context or is a hotkey (`XV(Lo,Ss)`). For any other printable key, `r1` returns false.
  - If such a key then reaches the composer, the composer change drops the band's hold (row 1 of the table). MEM records the same for a pane level with nothing focusable: typed keys go to the prompt. **Live check:** does a non-hotkey letter on a Button row leave the band?
- **Prompt focus requests.** No engine path moves the keys from the band to the prompt on its own, other than the table above. **Confirmed (source).**

## 3. Esc and closing

- **Bindings.** BUN: `{context:"AbovePrompt",bindings:{tab:"abovePrompt:next",right:"abovePrompt:next","shift+tab":"abovePrompt:previous",left:"abovePrompt:previous",enter:"abovePrompt:press",space:"abovePrompt:press",escape:"abovePrompt:leave",up:"pane:scrollUp",down:"pane:scrollDown",…}}`. `AbovePromptInput` and `AbovePromptSelect` also bind `escape:"abovePrompt:leave"`. The shortcut help describes `abovePrompt:leave` as "back to prompt". **Confirmed.**
- **No event fires.** The band's leave is `leave:()=>{Hn.forget(),Ne(null)}`. In `eqo`, `forget` is `be=le(()=>{z.current?.abort.abort(),z.current=void 0,Y.current=[]},[])`, which only aborts a pending ring move.
  - `ui.focus` isn't raised.
  - `ui.close` belongs to panes only: `PaneCloseOrigin` (DTS L7315-7322), "Every close raises `ui.close`" under `$.ui.close` (DTS L2486-2492).
  - The band has no `closeOnEscape`; that is a `PaneOpenArgs` field (DTS L7359-7368). The docs list "Esc: Returns keyboard focus to the prompt. With `closeOnEscape: true`, it also closes the pane" (CC:interface, "What each key does").
  - **Confirmed:** ctui can't see Esc in the band, so it can't step back a level on Esc.
- **Esc at the prompt.** Once the keys are back at the prompt, Esc is `escape:"chat:cancel"` in the `Chat` context (BUN), which interrupts a running reply. **Confirmed (binding).**
- **What could close a band menu.** The band is "always there" and a hook shows nothing by returning `next(e)` (CC:interface, "Band above the prompt"). ctui would close the menu by clearing a `$.state` flag and drawing nothing. Possible triggers, none of them Esc:
  - a Button: a hotkey Button, or `role: "dismiss"`, which is only a drawing hint (DTS L1113-1121)
  - running `/ctui` again
  - another event, such as `prompt.submit` or `turn.start`
- **Detecting a leave.** A poll of `$.ui.focus({ requestId, key })` would answer `{ deny: "that site does not hold the keyboard" }` once the band lost the keys, but it would also move the ring while the band holds them. The band's `requestId` is the one `ui.render` hands the hook: BUN has `var oq="above-prompt"` with `requestId:oq` in the band component. Read `e.requestId` rather than hard-coding it. **Live check.**

## 4. Reloads (`$.config.set`)

- **The module swaps in place.** BUN, in the reload path: `let Ke=s?r.loadedModules.map((Qe)=>Qe===s?Te:Qe):…;…r.loadedModules=Ke,…s?.retire()`. A failed reload throws `… failed on reload …` and the "previous version stays loaded". The new module replaces the old in one assignment, so the band always has a render hook. **Confirmed.**
- **The old tree stays drawn.** BUN `function ur(o,i,{version:p,…})`: on a new version the effect runs `ui.render` again and calls `d(b)` only when the answer arrives. It clears the drawing only `if(!o){d(void 0);return}`, that is, when no loaded module hooks the site (`var sSt=(e)=>lt().loadedModules.some(…)`). Between the reload and the new answer, the band keeps the old elements. **Confirmed.**
- **Focus survives.** The new tree's elements are still `plugin: "ctui"`, so `eoe` is false and the hold stays. **Confirmed (source); live check end to end.**
- **The ring is positional.** The hold state is an index into the focusables (`vn=typeof Me==="number"?Me:null`, `Un=gn[vn]`). An index past the end becomes the empty hold `"band"` (`s1(vn,gn.length,le(()=>Ne("band"),[]))`).
  - `autoFocus` re-lands only after the band was let go: in `eqo` the auto move is guarded by `he.current`, which resets only `if(!h)`. Within one hold, a reload that moves the autoFocus element doesn't move the ring.
  - MEM's pane notes say the same ("The ring keeps its index from the list"). The fix is the same too: `$.ui.focus` after the redraw, which works here because the band still holds the keys (§2.1). **Confirmed (source).**
- **A level with nothing focusable.** A redraw with no Button, Input or Select (and no scroll cue) drops the hold (§2.3, `rs`). Every level must keep at least one focusable element. **Confirmed.**
- **Module state.** Module variables reset on each reload and `$.state` survives (CC:interface, "Keep state"). The menu model stays in `$.state`, as today (MEM). Timers stop on reload (CC:interface, "Redraw on a timer"), so MEM's rule of flushing a waiting order write before any other write still applies.
- **Collapse.** The band's collapse flag is the in-memory store `var k2t=Ge(Fs(),(e)=>e.set(void 0))`, not a setting. While collapsed, the band draws `▸ plugin panel hidden · ctrl+x ctrl+a or click to show` and none of ctui's tree (`Ho=lo?void 0:tn`). No API expands it. A person who collapsed the band won't see the menu until they expand it. **Confirmed (source).**

## 5. Surveys and other mods

- **Surveys are separate.** The engine's surveys draw as their own component above the plugin band: BUN `function BY(h)` returns `r(Y,{children:[Rt,It,qt,ro,no]})`. `Rt` is the survey component (`nY`), `It` is `bS.AbovePromptSite` with `survey:ft`, and `qt` is the feedback prompt.
- **`hasSurvey`.** It is "True while a survey holds the band; a hook yields to it" (DTS L10181-10183). While it is true, ctui's tree still draws, but:
  - the band can't take the keys (`rs=!h&&…`)
  - an existing hold is dropped (`x(Dn,[h,Dn])`)
  - digit hotkeys are off (`enabled:!h&&…`)
  - the survey takes the digits

  So a menu opened during a survey is inert, and one that is open when a survey starts loses its keys. To yield, ctui should draw nothing while `hasSurvey`. **Confirmed.**
- **Other mods share one chain.** "A tree replaces what the mods after yours draw there. To keep theirs, put the result of `await next(e)` among the children of a `Box`" (CC:interface, "Band above the prompt"). `ui.render`: "`next(e)` resolves to the drawing: return it, wrap it, draw your own" (DTS L3943-3953). Two consequences:
  - ctui decides whether lower mods' bands show while the menu is up.
  - A mod above ctui that returns its own tree without `next` hides ctui's menu, and ctui can't prevent that.
- **One ring.** All plugins' Buttons, Inputs and Selects in the band share one focus ring (`gn=r6e(Ho)` flattens every element with its `plugin`). `$.ui.focus` is denied when "another plugin's element holds the keyboard" (BUN `function LB(e,n){…r!==void 0&&r!==n.name}`; DTS L13794-13795). If another mod's band elements sit beside the menu, Tab walks into them. **Confirmed.**

## 6. Size

- **`maxRows`.** "In fullscreen, what the bottom slot has left above the prompt; otherwise the terminal's height … That slot is capped at half the terminal's rows, the prompt's included" (DTS L10189-10199).
  - BUN, the band component's budget: `if(Pe===null)return Q;…Math.max(0,Math.min(Q,(…height)+_n))`, where `Q` is the terminal rows and `Pe` the fullscreen slot's remainder.
  - On a 40-row fullscreen terminal the band gets at most about 20 rows less the prompt and footer. **Confirmed; the exact count is a live check.**
- **Scrolling and the `n more` row.** BUN `function Gte(h){…he=H>Q,Se=he?Math.max(0,Q-1):Q;return{windowRows:Se,hasCue:he,maxOffset:Math.max(0,H-Se),bodyRows:Math.max(0,L-1)}}`.
  - A tree taller than the budget gives up one row to the cue, drawn by `KV` as `↑ N more · ↓ N more`.
  - The window follows the focused element (`Do((_n)=>Ozr({offset:_n,bodyRows:no,top:jn,bottom:Qo}))`).
  - `ui.scroll` fires before each move and `$.ui.scroll` moves it (DTS L4013-4023, L2503-2514).
  - Hotkeys only work for Buttons wholly in view (DTS L10195-10197). **Confirmed.**
- **Up/Down in an overflowing band.** BUN `var Kte=(h,k,L)=>({...h,...XOe(k),...!L&&{"pane:scrollUp":h["abovePrompt:previous"],"pane:scrollDown":h["abovePrompt:next"]}})`. Without the cue, Up/Down move between elements. With it, they scroll one row and Tab or ←/→ move between elements. CC:interface ("What each key does") says the same. **Confirmed.**
- **The Themes list.** It is a `Select` of `inherit` plus 22 Themes, 23 options (`ctui/hooks/menu.tsx` `menuView`; `ctui/themes/` holds 22 files). The terminal Select draws a window of `var ut=8` options plus `  … N more` (BUN `function ljn` and the `SelectField` `tr`).
  - In the band, an open Select's list is added on top of the budget: `maxHeight:Ct+Wn`, where `Wn=VV(Fr,os)` is the list's rows. It is also left out of the overflow count: `Rt=…height-vt.current`.
  - So the Themes level needs the title, the filter `Input` and one Select row within `maxRows`. Opening the Select adds up to 9 rows (8 options and the `… more` row) above that. The 23 options never reach the band's budget. **Confirmed (source).** **Live check:** how the extra rows push the transcript in fullscreen.
- **The Plugins screen.** The title, six section rows (`context`, `limits`, `todo`, `skills`, `mcp`, `agents`), a blank row and the hint row come to about 9 rows, plus the root `Box`'s `paddingY={1}` (`menuView`). That fits half of a typical terminal. Below that, the band scrolls with the cue, and Up/Down then scroll instead of moving rows (above). **Live check.**
- **Width.** `bodyColumns` is the column less the engine's five for `[-]`. The column is the transcript's beside a docked pane (DTS L10201-10208), so the Sidebar narrows the menu. **Confirmed.**

## 7. Elements

- **Shared code.** The band and panes build their elements from the same table (`ct`, which turns `Button`, `Input` and `Select` into `Xt`, `Kt` and `tr`). They use the same Select controller (`d1({…component:"AbovePrompt"…})` and `d1({…component:"Pane"…})`), the same Input fields (`ZV(gn,"AbovePrompt"` and `ZV(Lo,"Pane"`), the same ring keys (`QV`) and the same press path (`lRe`).
  - Drawing, Enter, the Select's type-ahead (`Kt(eo,ro.toLowerCase())`), Input typing and the `ui.press`, `ui.input`, `ui.select` and `ui.focus` events behave as in a pane.
  - The pane's binding context has the same `tab`, `shift+tab`, `enter` and `escape` actions (`{context:"Pane",bindings:{tab:"abovePrompt:next",…escape:"abovePrompt:leave",…}}`). **Confirmed.**
- **Hotkey Buttons.** Letters arm only while the band holds the keys and the focused element isn't an Input or Select (`XV(Lo,Ss)` with `Ss=ro&&!Qr&&!js`). The same is true in a pane. A `plain` hotkey Button draws `<key>: <label>` (DTS L1088-1095).
  - So `x`, `k` and `j` on the Plugins screen work once the band is held.
  - Band-only: digit hotkeys also work from an empty composer (§2.2).
  - Two Buttons on one hotkey: the later wins (DTS L1076). **Confirmed.**
- **Differences from a pane.** The band:
  - can't be focused by ctui (§2.1)
  - raises no event on Esc (§3)
  - drops its hold on a composer change, a survey or a pane focus (§2.3)
  - can be collapsed by the person (§4)
  - remaps Up/Down to scrolling when it overflows (§6)

  A pane has `closeOnEscape`, `$.ui.panes()` `isFocused` (DTS L13990-14007) and `focus` on open.

## 8. For the spike

Live checks, in order of risk:

1. After `/ctui` draws the menu, confirm that no key reaches it until Ctrl+X Tab, and that Ctrl+X Tab works mid-reply.
2. Esc in the band: confirm the keys return to the prompt with no `ui.focus` or other event, and that a second Esc at the prompt interrupts a running reply.
3. A `$.config.set` reload with the band held: does the hold survive, does the ring stay on its index, and does `$.ui.focus` after the redraw restore it?
4. A non-hotkey letter with a Button row focused: does it reach the composer and drop the hold?
5. The Themes level in a 40-row fullscreen terminal: the rows with the Select closed and open, and whether the transcript shifts.
6. A survey arriving while the menu is held.
