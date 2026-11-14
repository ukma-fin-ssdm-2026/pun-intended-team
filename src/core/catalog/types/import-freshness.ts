// Written with the help of Claude
/** How current one provider's imported events are (FR-014). */
export interface ProviderImportStatus {
  /** The provider's id, as stored with its events, e.g. `karabas`. */
  provider: string;
  /** When its last succeeded import run finished; null if none has succeeded yet. */
  lastSucceededAt: string | null;
  /** Whether its latest run that has ended failed, so its events may not be current. */
  latestRunFailed: boolean;
}
