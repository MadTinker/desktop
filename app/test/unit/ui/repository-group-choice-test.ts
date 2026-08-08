import assert from 'node:assert'
import { describe, it } from 'node:test'

import { ICustomRepositoryGroup } from '../../../src/ui/repositories-list/repository-group-types'
import {
  FavoritesChoiceValue,
  NewGroupChoiceValue,
  NoGroupChoiceValue,
  customGroupChoiceValue,
  resolveGroupChoice,
} from '../../../src/ui/add-repository/repository-group-choice'

const groups: ReadonlyArray<ICustomRepositoryGroup> = [
  { id: 'g1', name: 'Work', repositoryIds: [1] },
  { id: 'g2', name: 'Lab', repositoryIds: [] },
]

describe('resolveGroupChoice', () => {
  it('leaves the repository ungrouped by default', () => {
    assert.deepStrictEqual(resolveGroupChoice(NoGroupChoiceValue, '', groups), {
      kind: 'none',
    })
  })

  it('marks the repository a favorite', () => {
    assert.deepStrictEqual(
      resolveGroupChoice(FavoritesChoiceValue, '', groups),
      { kind: 'favorite' }
    )
  })

  it('files the repository under an existing group', () => {
    assert.deepStrictEqual(
      resolveGroupChoice(customGroupChoiceValue('g2'), '', groups),
      { kind: 'existing', groupId: 'g2' }
    )
  })

  it('falls back to ungrouped when the picked group was deleted mid-dialog', () => {
    assert.deepStrictEqual(
      resolveGroupChoice(customGroupChoiceValue('gone'), '', groups),
      { kind: 'none' }
    )
  })

  it('creates a group from the typed name', () => {
    assert.deepStrictEqual(
      resolveGroupChoice(NewGroupChoiceValue, '  Side Quests  ', groups),
      { kind: 'new', name: 'Side Quests' }
    )
  })

  it('reuses an existing group instead of creating a same-named duplicate', () => {
    assert.deepStrictEqual(
      resolveGroupChoice(NewGroupChoiceValue, 'work', groups),
      { kind: 'existing', groupId: 'g1' }
    )
  })

  it('ignores a blank new-group name rather than creating an unnamed group', () => {
    assert.deepStrictEqual(
      resolveGroupChoice(NewGroupChoiceValue, '   ', groups),
      { kind: 'none' }
    )
  })

  it('treats an unrecognised choice as ungrouped', () => {
    assert.deepStrictEqual(resolveGroupChoice('bogus', '', groups), {
      kind: 'none',
    })
  })
})
