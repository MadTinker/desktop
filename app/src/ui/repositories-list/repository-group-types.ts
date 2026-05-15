/**
 * Data types for user-defined repository organization:
 * favorites and custom groups, persisted in localStorage.
 */

export interface ICustomRepositoryGroup {
  readonly id: string
  readonly name: string
  readonly repositoryIds: ReadonlyArray<number>
}

export const FavoriteRepositoriesKey = 'favorite-repositories'
export const CustomRepositoryGroupsKey = 'custom-repository-groups'
export const CollapsedRepositoryGroupsKey = 'collapsed-repository-groups'
export const RepositoryCustomOrderKey = 'repository-custom-order'
