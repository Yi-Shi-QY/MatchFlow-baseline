import type { AnalysisDomain } from "../types";
import type { DomainUiPresenter } from "./types";

type DomainPresenterModule = {
  DOMAIN_UI_PRESENTER_ENTRIES?: DomainUiPresenter[];
};

function collectBuiltinDomainUiPresenters(): Record<string, DomainUiPresenter> {
  const modules = import.meta.glob("./presenters/*.ts", { eager: true }) as Record<
    string,
    DomainPresenterModule
  >;
  const entries = Object.values(modules).flatMap((module) =>
    Array.isArray(module.DOMAIN_UI_PRESENTER_ENTRIES)
      ? module.DOMAIN_UI_PRESENTER_ENTRIES
      : [],
  );

  const presenterMap: Record<string, DomainUiPresenter> = {};
  entries.forEach((presenter) => {
    if (!presenter || typeof presenter.id !== "string" || presenter.id.trim().length === 0) {
      return;
    }
    presenterMap[presenter.id] = presenter;
  });

  return presenterMap;
}

export const BUILTIN_DOMAIN_UI_PRESENTERS: Record<string, DomainUiPresenter> =
  collectBuiltinDomainUiPresenters();

function getFallbackDomainUiPresenter(): DomainUiPresenter {
  const fallback =
    BUILTIN_DOMAIN_UI_PRESENTERS.football || Object.values(BUILTIN_DOMAIN_UI_PRESENTERS)[0];
  if (!fallback) {
    throw new Error("No domain UI presenters discovered under domains/ui/presenters.");
  }
  return fallback;
}

function assertPresenterShape(domainId: string, presenter: DomainUiPresenter) {
  if (!presenter || typeof presenter !== "object") {
    throw new Error(`Domain ${domainId} must provide a valid UI presenter.`);
  }
  const supportsHomeEntityDisplay =
    presenter.home &&
    (typeof presenter.home.getEntityDisplay === "function" ||
      typeof presenter.home.getDisplayPair === "function");
  if (!supportsHomeEntityDisplay) {
    throw new Error(`Domain ${domainId} must provide a home presenter contract.`);
  }
  if (!presenter.history || typeof presenter.history.getOutcomeDistribution !== "function") {
    throw new Error(`Domain ${domainId} must provide a history presenter contract.`);
  }
  if (!presenter.result || typeof presenter.result.getSummaryDistribution !== "function") {
    throw new Error(`Domain ${domainId} must provide a result presenter contract.`);
  }
}

export function assertBuiltinDomainUiPresenter(domainId: string): void {
  const presenter = BUILTIN_DOMAIN_UI_PRESENTERS[domainId];
  if (!presenter) {
    throw new Error(
      `Domain ${domainId} must export DOMAIN_UI_PRESENTER_ENTRIES in domains/ui/presenters/${domainId}.ts`,
    );
  }
  assertPresenterShape(domainId, presenter);
}

export function getDomainUiPresenter(domain: AnalysisDomain): DomainUiPresenter {
  const presenter = BUILTIN_DOMAIN_UI_PRESENTERS[domain.id] || getFallbackDomainUiPresenter();
  assertPresenterShape(domain.id, presenter);
  return presenter;
}

export function getDomainHomePresenter(domain: AnalysisDomain) {
  return getDomainUiPresenter(domain).home;
}

export function getDomainHistoryPresenter(domain: AnalysisDomain) {
  return getDomainUiPresenter(domain).history;
}

export function getDomainResultPresenter(domain: AnalysisDomain) {
  return getDomainUiPresenter(domain).result;
}
