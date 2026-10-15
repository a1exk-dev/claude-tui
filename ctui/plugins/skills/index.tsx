import { skillName, sortedSkills } from '../../hooks/skills'
import { lead, MARKS, tally } from '../marks'
import type { SidebarPlugin } from '../plugin'

// The skills the chat has invoked, one row per skill: the rest ring from the
// Sidebar's shared circle vocabulary (`plugins/marks.tsx`), then its name in
// main, truncating, and its source muted at the right, never truncating.
//
// Skills draws no motion, and the section has no second mark: it is a
// cumulative session log — a row is added on first use, one per name and
// source, and never leaves — so it has no present tense for motion to attach
// to. The engine's half of that, and why no later reader should add a sweep
// back, is MEMORY.md "no-skill-for-a-call".
const plugin: SidebarPlugin = {
  id: 'skills',
  title: 'Skills',
  slot: 'section',
  needs: ['skills'],
  list: true,
  view: ({ skills = [] }, { Box, Text }, _cfg, _width, c) =>
    skills.length
      ? sortedSkills(skills).map((row) => (
          <Box flexGrow={1} justifyContent="space-between" columnGap={1}>
            <Text color={c.main} wrap="truncate-end">
              {lead(Text, MARKS.asterisk_circle_outline, c)}
              <Text color={c.main}>{skillName(row.name)}</Text>
            </Text>
            <Box flexShrink={0}>
              <Text color={c.muted}>{row.source}</Text>
            </Box>
          </Box>
        ))
      : [<Text color={c.faint}>no skills used yet</Text>],
  count: ({ skills = [] }) => String(skills.length),
  // Folded, the one rest ring before the count: one state, so one term. With
  // no rows there is no term to draw, and the count stands bare at 0.
  summary: ({ skills = [] }, { Text }, _cfg, _width, c) =>
    tally(Text, [{ mark: MARKS.asterisk_circle_outline, count: skills.length }], c) ?? String(skills.length),
}

export default plugin
