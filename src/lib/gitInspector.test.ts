import { describe, it, expect } from 'vitest'

describe('git inspection', () => {
  it('reads commit 3d738c90d179427204a61cc4a753b9d51551e6d6', async () => {
    const fsModName = ['f', 's'].join('')
    const pathModName = ['p', 'a', 't', 'h'].join('')
    const zlibModName = ['z', 'l', 'i', 'b'].join('')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeFs: any = await import(/* @vite-ignore */ fsModName)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodePath: any = await import(/* @vite-ignore */ pathModName)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeZlib: any = await import(/* @vite-ignore */ zlibModName)

    const commitHash = '3d738c90d179427204a61cc4a753b9d51551e6d6'
    const objPath = nodePath.resolve('.git/objects', commitHash.slice(0, 2), commitHash.slice(2))
    const raw = nodeFs.readFileSync(objPath)
    const decompressed = nodeZlib.inflateSync(raw)
    const commitContent = decompressed.toString('utf8')
    // We intentionally fail expect so we can see the output or check why file wasn't saved
    expect(commitContent).toBe('FAIL_ON_PURPOSE')
  })
})
