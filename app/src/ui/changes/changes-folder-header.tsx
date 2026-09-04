import * as React from 'react'

import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { DiffSelectionType } from '../../models/diff'
import { WorkingDirectoryFileChange } from '../../models/status'
import { formatNumber } from '../../lib/format-number'
import { plural } from '../lib/plural'
import { IChangesFolder } from './changes-folder-tree'

interface IChangesFolderHeaderProps {
  readonly folder: IChangesFolder
  readonly disableSelection: boolean
  readonly onToggle: (folder: IChangesFolder) => void
  readonly onIncludeChanged: (
    files: ReadonlyArray<WorkingDirectoryFileChange>,
    include: boolean
  ) => void
  readonly onContextMenu: (
    folder: IChangesFolder,
    event: React.MouseEvent<HTMLDivElement>
  ) => void
}

/** The foldable header of a folder of changed files. */
export class ChangesFolderHeader extends React.Component<
  IChangesFolderHeaderProps,
  {}
> {
  private get checkboxValue(): CheckboxValue {
    const selectionTypes = new Set(
      this.props.folder.allFiles.map(f => f.selection.getSelectionType())
    )

    if (selectionTypes.size === 1) {
      if (selectionTypes.has(DiffSelectionType.All)) {
        return CheckboxValue.On
      }

      if (selectionTypes.has(DiffSelectionType.None)) {
        return CheckboxValue.Off
      }
    }

    return CheckboxValue.Mixed
  }

  private onToggle = () => this.props.onToggle(this.props.folder)

  /**
   * Fold and unfold with the arrow keys, the way a tree view does. Left folds
   * an open folder up, right opens a folded one.
   */
  private onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const { collapsed } = this.props.folder

    if (
      (event.key === 'ArrowLeft' && !collapsed) ||
      (event.key === 'ArrowRight' && collapsed)
    ) {
      event.preventDefault()
      this.props.onToggle(this.props.folder)
    }
  }

  private onContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    this.props.onContextMenu(this.props.folder, event)
  }

  private onCheckboxChange = (event: React.FormEvent<HTMLInputElement>) => {
    this.props.onIncludeChanged(
      this.props.folder.allFiles,
      event.currentTarget.checked
    )
  }

  public render() {
    const { folder, disableSelection } = this.props
    const { allFiles, collapsed, depth, label, path } = folder

    const fileCount = `${formatNumber(allFiles.length)} changed file${plural(
      allFiles.length
    )}`

    return (
      <div
        className="changes-folder-header"
        style={{ paddingLeft: `calc(var(--spacing) + ${depth * 12}px)` }}
        onContextMenu={this.onContextMenu}
      >
        <Checkbox
          // The checkbox isn't tab reachable, the folder button next to it
          // carries the row's keyboard interaction.
          tabIndex={-1}
          value={this.checkboxValue}
          onChange={this.onCheckboxChange}
          disabled={disableSelection}
        />
        <button
          className="folder-toggle"
          type="button"
          onClick={this.onToggle}
          onKeyDown={this.onKeyDown}
          // Lets the changes list move focus here when a file row folds its
          // folder up and the row the user was on disappears.
          data-folder-path={path}
          aria-expanded={!collapsed}
          aria-label={`${path}, ${fileCount}`}
        >
          <Octicon
            symbol={collapsed ? octicons.chevronRight : octicons.chevronDown}
            className="folder-chevron"
          />
          <span className="folder-name">{label}</span>
          <span className="folder-file-count">
            {formatNumber(allFiles.length)}
          </span>
        </button>
      </div>
    )
  }
}
