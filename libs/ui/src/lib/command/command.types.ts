/**
 * Filter mode for the command component.
 * - manual: Consumer is responsible for filtering options
 * - auto-select: Automatically selects first matching option
 * - highlight: Highlights matching text without changing selection
 */
export type CommandFilterMode = 'manual' | 'auto-select' | 'highlight';
