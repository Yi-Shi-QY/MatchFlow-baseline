export interface DomainHomeHistoryTheme {
  sectionTitleKey: string;
  sectionIconClassName: string;
  cardClassName: string;
  activeCardClassName: string;
  headerMetaClassName: string;
  timestampClassName: string;
  deleteButtonClassName: string;
  footerClassName: string;
  activeStatusClassName: string;
  completedStatusClassName: string;
  distributionTrackClassName: string;
  distributionLabelClassName: string;
  barPalette: string[];
}

export interface DomainResultSummaryTheme {
  titleKey: string;
  cardClassName: string;
  headerClassName: string;
  titleClassName: string;
  contentClassName: string;
  heroNameClassName: string;
  heroCaptionClassName: string;
  distributionLabelClassName: string;
  distributionTrackClassName: string;
  conclusionCardClassName: string;
  conclusionMetaClassName: string;
  quoteCardClassName: string;
  keyFactorClassName: string;
  barPalette: string[];
}

export interface DomainUiTheme {
  id: string;
  home?: {
    history?: Partial<DomainHomeHistoryTheme>;
  };
  result?: {
    summary?: Partial<DomainResultSummaryTheme>;
  };
}

export interface ResolvedDomainUiTheme {
  id: string;
  home: {
    history: DomainHomeHistoryTheme;
  };
  result: {
    summary: DomainResultSummaryTheme;
  };
}
