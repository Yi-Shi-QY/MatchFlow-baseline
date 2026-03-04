// Compatibility adapter. New code should import from "./savedSubjects".
export type {
  SaveSubjectOptions as SaveMatchOptions,
  SavedSubjectQueryOptions as SavedMatchQueryOptions,
  SavedSubjectRecord as SavedMatchRecord,
} from './savedSubjects';
export {
  getSavedSubjects as getSavedMatches,
  saveSubject as saveMatch,
  deleteSavedSubject as deleteSavedMatch,
  clearSavedSubjects,
  clearSavedSubjectsByDomain,
} from './savedSubjects';
