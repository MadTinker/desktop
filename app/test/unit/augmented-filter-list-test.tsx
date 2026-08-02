import * as React from 'react'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createStateUpdate } from '../../src/ui/lib/augmented-filter-list'
import { IFilterListGroup, IFilterListItem } from '../../src/ui/lib/filter-list'

interface ITestItem extends IFilterListItem {
  readonly id: string
  readonly text: ReadonlyArray<string>
}

const item = (id: string): ITestItem => ({ id, text: [id] })

function rowsFor(
  groups: ReadonlyArray<IFilterListGroup<ITestItem>>,
  renderGroupHeader: boolean
) {
  const { rows } = createStateUpdate<ITestItem>(
    {
      groups,
      selectedItems: [],
      renderItem: () => null,
      renderGroupHeader: renderGroupHeader
        ? () => React.createElement('div')
        : undefined,
    } as any,
    null
  )

  return rows.map(section =>
    section.map(r => (r.kind === 'group' ? `[${r.identifier}]` : r.item.id))
  )
}

describe('augmented filter list rows', () => {
  it('drops a group that has no items', () => {
    assert.deepStrictEqual(
      rowsFor(
        [
          { identifier: 'empty', items: [] },
          { identifier: 'full', items: [item('a')] },
        ],
        true
      ),
      [['[full]', 'a']]
    )
  })

  it('keeps the header of an empty group that asks for it', () => {
    assert.deepStrictEqual(
      rowsFor(
        [
          { identifier: 'collapsed', items: [], showHeaderWhenEmpty: true },
          { identifier: 'full', items: [item('a')] },
        ],
        true
      ),
      [['[collapsed]'], ['[full]', 'a']]
    )
  })

  it('still drops an empty group when no header would be rendered', () => {
    assert.deepStrictEqual(
      rowsFor(
        [
          { identifier: 'collapsed', items: [], showHeaderWhenEmpty: true },
          { identifier: 'full', items: [item('a')] },
        ],
        false
      ),
      [['a']]
    )
  })

  it('does not render a header for a group that opted out of one', () => {
    assert.deepStrictEqual(
      rowsFor(
        [{ identifier: 'headerless', items: [item('a')], showHeader: false }],
        true
      ),
      [['a']]
    )
  })
})
