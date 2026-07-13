import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { join } from 'path'
import { RepositoriesStore } from '../../src/lib/stores/repositories-store'
import { TestRepositoriesDatabase } from '../helpers/databases'
import { IAPIFullRepository, getDotComAPIEndpoint } from '../../src/lib/api'
import { assertIsRepositoryWithGitHubRepository } from '../../src/models/repository'

describe('RepositoriesStore', () => {
  let repoDb = new TestRepositoriesDatabase()
  let repositoriesStore = new RepositoriesStore(repoDb)

  beforeEach(async () => {
    repoDb = new TestRepositoriesDatabase()
    await repoDb.reset()
    repositoriesStore = new RepositoriesStore(repoDb)
  })

  describe('adding a new repository', () => {
    it('contains the added repository', async () => {
      const repoPath = '/some/cool/path'
      await repositoriesStore.addRepository(repoPath, join(repoPath, '.git'))

      const repositories = await repositoriesStore.getAll()
      assert.equal(repositories[0].path, repoPath)
    })
  })

  describe('getting all repositories', () => {
    it('returns multiple repositories', async () => {
      await repositoriesStore.addRepository(
        '/some/cool/path',
        '/some/cool/path/.git'
      )
      await repositoriesStore.addRepository(
        '/some/other/path',
        '/some/other/path/.git'
      )

      const repositories = await repositoriesStore.getAll()
      assert.equal(repositories.length, 2)
    })
  })

  describe('updating a repository path', () => {
    it('changes the path of the repository', async () => {
      const repo = await repositoriesStore.addRepository(
        '/some/cool/path',
        '/some/cool/path/.git'
      )

      await repositoriesStore.updateRepositoryPath(
        repo,
        '/some/moved/path',
        '/some/moved/path/.git'
      )

      const repositories = await repositoriesStore.getAll()
      assert.equal(repositories.length, 1)
      assert.equal(repositories[0].path, '/some/moved/path')
    })

    it('dedupes when another record already occupies the target path', async () => {
      // Reproduces the submodule heal loop: a record kept its git-dir as
      // `path` (older build) while the working tree was also added correctly.
      // Healing the git-dir record onto the worktree path must not throw on
      // the unique `path` index — it should drop the duplicate instead.
      const worktreePath = '/repo/ElementalAlloy'
      const gitDirPath = '/repo/.git/modules/ellie-api-master'

      await repositoriesStore.addRepository(
        worktreePath,
        join(worktreePath, '.git')
      )
      const gitDirRepo = await repositoriesStore.addRepository(
        gitDirPath,
        gitDirPath
      )

      await assert.doesNotReject(() =>
        repositoriesStore.updateRepositoryPath(
          gitDirRepo,
          worktreePath,
          join(worktreePath, '.git')
        )
      )

      const repositories = await repositoriesStore.getAll()
      assert.equal(repositories.length, 1)
      assert.equal(repositories[0].path, worktreePath)
      assert.ok(!repositories.some(r => r.path.includes('.git/modules')))
    })
  })

  describe('updating a GitHub repository', () => {
    const apiRepo: IAPIFullRepository = {
      clone_url: 'https://github.com/my-user/my-repo',
      ssh_url: 'git@github.com:my-user/my-repo.git',
      html_url: 'https://github.com/my-user/my-repo',
      name: 'my-repo',
      owner: {
        id: 42,
        html_url: 'https://github.com/my-user',
        login: 'my-user',
        avatar_url: 'https://github.com/my-user.png',
        type: 'User',
      },
      private: true,
      fork: false,
      default_branch: 'master',
      pushed_at: '1995-12-17T03:24:00',
      has_issues: true,
      archived: false,
      permissions: {
        pull: true,
        push: true,
        admin: false,
      },
      parent: undefined,
    }
    const endpoint = getDotComAPIEndpoint()

    it('adds a new GitHub repository', async () => {
      await repositoriesStore.setGitHubRepository(
        await repositoriesStore.addRepository(
          '/some/cool/path',
          '/some/cool/path/.git'
        ),
        await repositoriesStore.upsertGitHubRepository(endpoint, apiRepo)
      )

      const repositories = await repositoriesStore.getAll()
      const repo = repositories[0]
      assertIsRepositoryWithGitHubRepository(repo)
      assert(repo.gitHubRepository.isPrivate)
      assert(!repo.gitHubRepository.fork)
      assert.equal(
        repo.gitHubRepository.htmlURL,
        'https://github.com/my-user/my-repo'
      )
    })

    it('reuses an existing GitHub repository', async () => {
      const firstRepo = await repositoriesStore.setGitHubRepository(
        await repositoriesStore.addRepository(
          '/some/cool/path',
          '/some/cool/path/.git'
        ),
        await repositoriesStore.upsertGitHubRepository(endpoint, apiRepo)
      )

      const secondRepo = await repositoriesStore.setGitHubRepository(
        await repositoriesStore.addRepository(
          '/some/other/path',
          '/some/other/path/.git'
        ),
        await repositoriesStore.upsertGitHubRepository(endpoint, apiRepo)
      )

      assert.equal(
        firstRepo.gitHubRepository.dbID,
        secondRepo.gitHubRepository.dbID
      )
    })
  })
})
