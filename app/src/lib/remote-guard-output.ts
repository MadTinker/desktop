import { TerminalOutput } from './git/core'
import { RemoteGuardBlockMarker } from '../models/remote-policy'

/**
 * Did a failed hook's output come from the `remote-guard` pre-push script
 * refusing the push?
 *
 * Hook output arrives as a string, a Buffer, or a list of Buffer chunks. A
 * chunked marker could in principle straddle a boundary, so the chunks are
 * joined before matching rather than tested one at a time.
 */
export function containsRemoteGuardBlock(output: TerminalOutput): boolean {
  return coerceTerminalOutput(output).includes(RemoteGuardBlockMarker)
}

function coerceTerminalOutput(output: TerminalOutput): string {
  if (typeof output === 'string') {
    return output
  }

  if (Array.isArray(output)) {
    return Buffer.concat(output).toString('utf8')
  }

  return output.toString('utf8')
}
