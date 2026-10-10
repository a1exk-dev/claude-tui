import { expect, test } from 'claude-code/testing'

import {
  applyAgentList,
  enqueue,
  failureReason,
  notificationReason,
  parseTaskNotification,
  toastText,
  type Toast,
} from '../hooks/tasks'
import type { Task } from '../types'

// The task model's pure parts: the task-notification parser on strings
// captured on 2.1.288 (#13, #14, #15), failure reasons, toast texts and the
// toast queue's order.

// #15 run 1: a background shell that exits 3, as `prompt.submit` hands it.
const SHELL_FAILED = `<task-notification>
<task-id>b0f4ymn46</task-id>
<tool-use-id>toolu_01HkQ9mZ3xVb7gTq2LwYc8Rd</tool-use-id>
<output-file>/tmp/claude-1000/-srv-x/tasks/b0f4ymn46.output</output-file>
<status>failed</status>
<summary>Background command "Exit with code 3 after 2 seconds" failed with exit code 3</summary>
</task-notification>`

// #15 run 2: a background shell that completes.
const SHELL_COMPLETED = `<task-notification>
<task-id>b2ks3xm35</task-id>
<tool-use-id>toolu_01AbCdEfGhIjKlMnOpQrStUv</tool-use-id>
<output-file>/tmp/claude-1000/-srv-x/tasks/b2ks3xm35.output</output-file>
<status>completed</status>
<summary>Background command "sleep 3; echo hi" completed (exit code 0)</summary>
</task-notification>`

// #13 R1: an agent that finished, with its usage.
const AGENT_COMPLETED = `<task-notification>
<task-id>ab89930ac3538a164</task-id>
<tool-use-id>toolu_01ZyXwVuTsRqPoNmLkJiHgFe</tool-use-id>
<status>completed</status>
<summary>Agent "ok probe" finished</summary>
<result>ok</result>
<usage><total_tokens>1520</total_tokens><tool_uses>0</tool_uses><duration_ms>971</duration_ms></usage>
</task-notification>`

// #13 R1: an agent dead on an API error.
const AGENT_FAILED = `<task-notification>
<task-id>a97362df45f1fc231</task-id>
<tool-use-id>toolu_01QwErTyUiOpAsDfGhJkLzXc</tool-use-id>
<status>failed</status>
<summary>Agent "FAIL probe" failed: Agent terminated early due to an API error: There's an issue with the selected model (claude-haiku-9-9-20990101). It may not exist or you may not have access to it. Run --model to pick a different model. (error type model_not_found, HTTP 404, request id req_011CXYZ, model sent to the API: claude-haiku-9-9-20990101)</summary>
</task-notification>`

// #14: a shell killed from /tasks, as the `queued_command` row's text block.
const SHELL_KILLED = `<system-reminder>
[SYSTEM NOTIFICATION - NOT USER INPUT] A background task you started has an update.
<task-notification>
<task-id>bq7c1x2pe</task-id>
<tool-use-id>toolu_01MnBvCxZaSdFgHjKlPoIuYt</tool-use-id>
<output-file>/tmp/claude-1000/-srv-x/tasks/bq7c1x2pe.output</output-file>
<status>killed</status>
<summary>Task "sleep 300" was stopped by the user</summary>
</task-notification>
</system-reminder>`

test('parseTaskNotification reads a shell failure with its exit code', () => {
  expect(parseTaskNotification(SHELL_FAILED)).toEqual({
    id: 'b0f4ymn46',
    status: 'failed',
    summary: 'Background command "Exit with code 3 after 2 seconds" failed with exit code 3',
    exitCode: 3,
  })
})

test('parseTaskNotification reads a completed shell and agent', () => {
  expect(parseTaskNotification(SHELL_COMPLETED)).toMatchObject({ id: 'b2ks3xm35', status: 'completed', exitCode: 0 })
  expect(parseTaskNotification(AGENT_COMPLETED)).toEqual({
    id: 'ab89930ac3538a164',
    status: 'completed',
    summary: 'Agent "ok probe" finished',
  })
})

test('parseTaskNotification reads a failed agent and a kill inside a system reminder', () => {
  expect(parseTaskNotification(AGENT_FAILED)).toMatchObject({ id: 'a97362df45f1fc231', status: 'failed' })
  expect(parseTaskNotification(SHELL_KILLED)).toMatchObject({ id: 'bq7c1x2pe', status: 'killed' })
})

test('parseTaskNotification needs a task id and a status', () => {
  expect(parseTaskNotification('hello')).toBeUndefined()
  expect(parseTaskNotification('<task-notification><status>failed</status></task-notification>')).toBeUndefined()
  expect(parseTaskNotification('<task-notification><task-id>b1</task-id></task-notification>')).toBeUndefined()
})

test('failure reasons: StopFailure words map to short phrases', () => {
  expect(failureReason('model_not_found')).toBe('model not found')
  expect(failureReason('rate_limit')).toBe('rate limited')
  expect(failureReason('overloaded')).toBe('API overloaded')
  expect(failureReason('authentication_failed')).toBe('auth failed')
  expect(failureReason('billing_error')).toBe('billing')
  expect(failureReason('max_output_tokens')).toBe('output limit')
  expect(failureReason('server_error')).toBe('server error')
})

test('failure reasons from a notification: the API error to its first period, or the exit code', () => {
  const reason = (text: string) => notificationReason(parseTaskNotification(text)!)
  expect(reason(AGENT_FAILED)).toBe("There's an issue with the selected model (claude-haiku-9-9-20990101)")
  expect(reason(SHELL_FAILED)).toBe('exit code 3')
  expect(notificationReason({ id: 'a', status: 'failed' })).toBeUndefined()
})

const task = (fields: Partial<Task>): Task => ({
  id: 'a1',
  kind: 'agent',
  type: 'Explore',
  label: 'list work dir',
  status: 'running',
  startedAt: 0,
  ...fields,
})

test('toast texts, one line each', () => {
  expect(toastText.started(task({}))).toBe('◆ Explore started: list work dir')
  expect(toastText.started(task({ kind: 'shell', type: 'shell', label: 'npm test' }))).toBe(
    '$ npm test started in background',
  )
  expect(toastText.started(task({ kind: 'workflow', type: 'workflow', label: 'review' }))).toBe(
    '◆ workflow started: review',
  )
  expect(toastText.started(task({ label: 'two\nlines' }))).toBe('◆ Explore started: two lines')
  expect(toastText.ended(task({ status: 'completed', endedAt: 4000 }))).toBe('✓ Explore done · list work dir · 4s')
  const shell = task({ kind: 'shell', type: 'shell', label: 'npm test', status: 'completed', endedAt: 75_000 })
  expect(toastText.ended(shell)).toBe('✓ shell done · npm test · 1m 15s')
  expect(toastText.ended(task({ status: 'failed', reason: 'model not found' }))).toBe(
    '✗ Explore failed: model not found',
  )
  expect(toastText.ended(task({ status: 'failed' }))).toBe('✗ Explore failed')
  expect(toastText.ended(task({ status: 'killed' }))).toBe('✗ Explore killed')
})

test('the agent list ends a running agent; a kill raises no toast; an ended agent can run again', () => {
  const tasks = {
    a1: task({ id: 'a1' }),
    a2: task({ id: 'a2' }),
    a3: task({ id: 'a3', status: 'completed', endedAt: 1 }),
  }
  const list = [
    { id: 'a1', status: 'completed' },
    { id: 'a2', status: 'killed' },
    { id: 'a3', status: 'running' },
  ]
  const raised = applyAgentList(tasks, list, 4000)
  expect(raised.map((toast) => toast.text)).toEqual(['✓ Explore done · list work dir · 4s'])
  expect(Object.values(tasks).map(({ status, endedAt }) => [status, endedAt])).toEqual([
    ['completed', 4000],
    ['killed', 4000],
    ['running', undefined],
  ])
})

test('the agent list acts on a change of its own status only', () => {
  const tasks = { a1: task({ id: 'a1', status: 'failed', endedAt: 1, listed: 'running' }) }
  expect(applyAgentList(tasks, [{ id: 'a1', status: 'running' }], 4000)).toEqual([])
  expect(tasks.a1.status).toBe('failed')
  applyAgentList(tasks, [{ id: 'a1', status: 'failed' }], 5000)
  expect([tasks.a1.status, tasks.a1.endedAt]).toEqual(['failed', 1])
})

// From 2.1.292 an agent reads `waiting` while it waits on its own background
// work (#246); only completed, failed and killed end a row.
test('the agent list keeps a waiting agent running, and an ended agent that reads waiting runs again', () => {
  const tasks = { a1: task({ id: 'a1' }), a2: task({ id: 'a2', status: 'completed', endedAt: 1 }) }
  const waiting = [
    { id: 'a1', status: 'waiting' },
    { id: 'a2', status: 'waiting' },
  ]
  expect(applyAgentList(tasks, waiting, 4000)).toEqual([])
  expect(Object.values(tasks).map(({ status, endedAt }) => [status, endedAt])).toEqual([
    ['running', undefined],
    ['running', undefined],
  ])
  expect(applyAgentList(tasks, [{ id: 'a1', status: 'running' }], 5000)).toEqual([])
  const raised = applyAgentList(tasks, [{ id: 'a1', status: 'completed' }], 6000)
  expect(raised.map((toast) => toast.text)).toEqual(['✓ Explore done · list work dir · 6s'])
})

const start = (id: string): Toast => ({ id, end: false, text: `start ${id}` })
const end = (id: string): Toast => ({ id, end: true, text: `end ${id}` })

test('the queue takes an end before waiting starts, in arrival order among ends', () => {
  let queue: Toast[] = []
  for (const toast of [start('a'), start('b'), end('c'), end('d'), start('e')]) queue = enqueue(queue, toast)
  expect(queue.map((toast) => toast.text)).toEqual(['end c', 'end d', 'start a', 'start b', 'start e'])
})

test("an end drops its own waiting start", () => {
  let queue: Toast[] = []
  for (const toast of [start('a'), start('b'), end('a')]) queue = enqueue(queue, toast)
  expect(queue.map((toast) => toast.text)).toEqual(['end a', 'start b'])
})
