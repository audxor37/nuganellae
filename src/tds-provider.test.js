import { readFileSync } from 'node:fs'
import { join } from 'node:path'

test('wraps the React root with the TDS Mobile AIT provider', () => {
  const mainSource = readFileSync(join(process.cwd(), 'src', 'main.jsx'), 'utf8')

  expect(mainSource).toContain("import { TDSMobileAITProvider } from '@toss/tds-mobile-ait'")
  expect(mainSource).toMatch(
    /<TDSMobileAITProvider>\s*<App \/>\s*<\/TDSMobileAITProvider>/,
  )
})
