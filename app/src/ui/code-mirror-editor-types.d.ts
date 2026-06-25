/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Minimal ambient typing for the full (editable) CodeMirror 5 editor entry
 * point. The project ships no @types/codemirror and the existing
 * `highlighter/globals.d.ts` only covers the read-only runmode build, so we
 * declare just the surface the Dotfiles editor uses.
 */
declare module 'codemirror/lib/codemirror.js' {
  interface CodeMirrorEditorInstance {
    getValue(): string
    setValue(value: string): void
    on(event: 'change', handler: (cm: CodeMirrorEditorInstance) => void): void
    refresh(): void
    focus(): void
    setOption(option: string, value: unknown): void
    getWrapperElement(): HTMLElement
  }

  interface CodeMirrorEditorConfig {
    value?: string
    mode?: string
    theme?: string
    lineNumbers?: boolean
    lineWrapping?: boolean
    readOnly?: boolean
    extraKeys?: {
      [key: string]: (cm: CodeMirrorEditorInstance) => void
    }
  }

  function CodeMirror(
    element: HTMLElement,
    config?: CodeMirrorEditorConfig
  ): CodeMirrorEditorInstance

  export = CodeMirror
}
