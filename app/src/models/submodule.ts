export type SubmoduleEntryStatus =
  | 'initialized'
  | 'uninitialized'
  | 'modified'
  | 'conflict'

export class SubmoduleEntry {
  public constructor(
    public readonly sha: string,
    public readonly path: string,
    public readonly describe: string,
    public readonly status: SubmoduleEntryStatus
  ) {}
}
