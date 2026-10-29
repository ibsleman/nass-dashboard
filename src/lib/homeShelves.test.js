import { describe, it, expect } from 'vitest'
import { togglePin, toggleHide, addPick, removePick, move, setMode, restOf, REASON_LABEL, SHELF_LIMIT } from './homeShelves'

const state = (mode, items = []) => ({ mode, items })
const it_ = (kind, template_id, position = 0) => ({ kind, template_id, position })
const ids = (s, kind) => s.items.filter((i) => i.kind === kind).sort((a, b) => a.position - b.position).map((i) => i.template_id)

describe('pin and hide (auto mode)', () => {
  it('pins go to the end of the pinned list and unpin on second tap', () => {
    let s = togglePin(state('auto', [it_('pin', 'a', 0)]), 'b')
    expect(ids(s, 'pin')).toEqual(['a', 'b'])
    s = togglePin(s, 'a')
    expect(ids(s, 'pin')).toEqual(['b'])
    expect(s.items.find((i) => i.template_id === 'b').position).toBe(0)
  })

  it('pinning a hidden template un-hides it, hiding a pinned one un-pins it', () => {
    let s = togglePin(state('auto', [it_('hide', 'a')]), 'a')
    expect(ids(s, 'hide')).toEqual([])
    expect(ids(s, 'pin')).toEqual(['a'])
    s = toggleHide(s, 'a')
    expect(ids(s, 'pin')).toEqual([])
    expect(ids(s, 'hide')).toEqual(['a'])
    expect(ids(toggleHide(s, 'a'), 'hide')).toEqual([])
  })

  it('does not mutate the input', () => {
    const s = state('auto', [it_('pin', 'a')])
    togglePin(s, 'b')
    expect(s.items).toHaveLength(1)
  })
})

describe('manual picks', () => {
  it('adds, removes and reorders picks', () => {
    let s = addPick(state('manual'), 'a')
    s = addPick(s, 'b')
    s = addPick(s, 'a') // مكرر لا يُضاف
    expect(ids(s, 'pick')).toEqual(['a', 'b'])
    s = move(s, 'pick', 'b', -1)
    expect(ids(s, 'pick')).toEqual(['b', 'a'])
    s = move(s, 'pick', 'b', -1) // أول القائمة: لا شيء
    expect(ids(s, 'pick')).toEqual(['b', 'a'])
    expect(ids(removePick(s, 'b'), 'pick')).toEqual(['a'])
  })

  it('caps picks at the shelf limit', () => {
    let s = state('manual')
    for (let i = 0; i < SHELF_LIMIT + 3; i++) s = addPick(s, `t${i}`)
    expect(ids(s, 'pick')).toHaveLength(SHELF_LIMIT)
  })

  it('reorders pins too', () => {
    const s = move(state('auto', [it_('pin', 'a', 0), it_('pin', 'b', 1)]), 'pin', 'a', 1)
    expect(ids(s, 'pin')).toEqual(['b', 'a'])
  })
})

describe('switching mode', () => {
  it('manual starts from what the shelf shows now when there are no picks yet', () => {
    const s = setMode(state('auto', [it_('pin', 'x')]), 'manual', ['x', 'y', 'z'])
    expect(s.mode).toBe('manual')
    expect(ids(s, 'pick')).toEqual(['x', 'y', 'z'])
    expect(ids(s, 'pin')).toEqual(['x']) // المثبّت يبقى للعودة إلى التلقائي
  })

  it('keeps earlier picks instead of overwriting them', () => {
    const s = setMode(state('auto', [it_('pick', 'old')]), 'manual', ['x'])
    expect(ids(s, 'pick')).toEqual(['old'])
  })
})

describe('the list under the shelf', () => {
  const catalog = [{ template_id: 'a' }, { template_id: 'b' }, { template_id: 'c' }]
  it('lists everything not on the shelf, newest order kept', () => {
    expect(restOf(catalog, [{ template_id: 'b' }]).map((r) => r.template_id)).toEqual(['a', 'c'])
  })
})

it('every reason has an Arabic label', () => {
  for (const r of ['pin', 'today', 'week', 'newest', 'manual']) expect(REASON_LABEL[r]).toBeTruthy()
})
