import { ICustomRepositoryGroup } from '../repositories-list/repository-group-types'

/**
 * Values used by the group `<select>` on the add-repository dialog. Custom
 * groups are addressed by id (names are user-editable and not unique), so they
 * carry a prefix to keep them apart from the fixed choices.
 */
export const NoGroupChoiceValue = 'none'
export const FavoritesChoiceValue = 'favorites'
export const NewGroupChoiceValue = 'new'
export const CustomGroupChoicePrefix = 'group:'

/** Build the `<option>` value that addresses a given custom group. */
export function customGroupChoiceValue(groupId: string): string {
  return `${CustomGroupChoicePrefix}${groupId}`
}

/**
 * What should happen to a freshly added repository, once the user's pick on the
 * add-repository dialog has been reconciled against the groups that actually
 * exist.
 */
export type GroupAssignment =
  /** Leave the repository ungrouped. */
  | { readonly kind: 'none' }
  /** Mark it a favorite. */
  | { readonly kind: 'favorite' }
  /** File it under a group that already exists. */
  | { readonly kind: 'existing'; readonly groupId: string }
  /** Create a group with this (trimmed, non-empty) name and file it there. */
  | { readonly kind: 'new'; readonly name: string }

/**
 * Resolve the dialog's raw selection into the action to take on the new
 * repository.
 *
 * Pure, and deliberately forgiving — the dialog stays open long enough for the
 * group list to change underneath it (a group can be renamed or deleted from
 * the repository list while it sits there), so anything that no longer lines up
 * degrades to leaving the repository ungrouped rather than throwing. Adding a
 * repository is the user's actual goal here; a stale group pick shouldn't
 * abort it.
 *
 * A "new group" name that collides with an existing group resolves to that
 * group instead of creating a duplicate. The comparison ignores case and
 * surrounding whitespace, so typing "work" when "Work" exists reuses "Work".
 */
export function resolveGroupChoice(
  choice: string,
  newGroupName: string,
  groups: ReadonlyArray<ICustomRepositoryGroup>
): GroupAssignment {
  if (choice === FavoritesChoiceValue) {
    return { kind: 'favorite' }
  }

  if (choice === NewGroupChoiceValue) {
    const name = newGroupName.trim()

    if (name.length === 0) {
      return { kind: 'none' }
    }

    const existing = groups.find(
      g => g.name.trim().toLowerCase() === name.toLowerCase()
    )

    return existing
      ? { kind: 'existing', groupId: existing.id }
      : { kind: 'new', name }
  }

  if (choice.startsWith(CustomGroupChoicePrefix)) {
    const groupId = choice.slice(CustomGroupChoicePrefix.length)

    // The group may have been deleted while the dialog was open.
    return groups.some(g => g.id === groupId)
      ? { kind: 'existing', groupId }
      : { kind: 'none' }
  }

  return { kind: 'none' }
}
