import { skillName, sortedSkills } from '../../hooks/skills'
import type { SidebarPlugin } from '../plugin'

// The skills the chat has invoked, one row per skill: its name in main,
// truncating, and its source muted at the right, never truncating.
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
              {skillName(row.name)}
            </Text>
            <Box flexShrink={0}>
              <Text color={c.muted}>{row.source}</Text>
            </Box>
          </Box>
        ))
      : [<Text color={c.faint}>no skills used yet</Text>],
  count: ({ skills = [] }) => String(skills.length),
  summary: ({ skills = [] }) => String(skills.length),
}

export default plugin
