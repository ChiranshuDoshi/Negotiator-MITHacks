/**
 * In-memory account + workflow store for the integrated demo (Person 2).
 *
 * This is the lightweight, hackathon-scoped persistence layer that the browser
 * flow drives: signup creates an account + a workflow, and each pipeline stage
 * (research → quotes → negotiation) updates the same workflow. State lives on
 * `globalThis` so it survives Next dev module reloads, mirroring how the existing
 * `quoteCollections` / `conversationSessions` singletons behave.
 */
import { randomUUID } from "node:crypto";

import type {
  ConfirmedQuoteRequest,
  NegotiationHandoff,
  ProviderRankingResult,
} from "@/domain/schemas/person4";

export interface Account {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly createdAt: string;
  readonly workflowId: string;
}

export type WorkflowStage =
  | "profile"
  | "research_ready"
  | "quotes_ready"
  | "negotiating"
  | "result";

export interface ResearchProviderView {
  providerId: string;
  providerName: string;
  rank: number;
  rating: number | null;
  reviewCount: number | null;
  website: string | null;
  eligibility: string;
}

export interface QuoteView {
  quoteId: string;
  providerId: string;
  providerName: string;
  rank: number;
  rating: number | null;
  reviewCount: number | null;
  effectiveComparisonCostCents: number | null;
  annualizedCostCents: number | null;
  monthlyCents: number | null;
  deductibleCents: number | null;
  coverageEquivalence: string;
  redFlags: string[];
  recommended: boolean;
}

export interface NegotiationStepView {
  label: string;
  amountCents: number;
  time: string;
  impactCents: number | null;
}

export interface TranscriptLineView {
  time: string;
  speaker: string;
  text: string;
}

export type NegotiationCallStatus =
  | "idle"
  | "ringing"
  | "dialing"
  | "in_progress"
  | "processing"
  | "completed"
  | "failed";

export interface NegotiationResultView {
  selectedQuoteId: string;
  providerId: string;
  providerName: string;
  targetAmountCents: number;
  originalCents: number;
  finalCents: number;
  savingsCents: number;
  savingsPct: number;
  targetMet: boolean;
  steps: NegotiationStepView[];
  transcript: TranscriptLineView[];
  mode: "simulated" | "live";
  // Live-call tracking (mode === "live").
  callStatus: NegotiationCallStatus;
  conversationId: string | null;
  callSid: string | null;
  recordingAvailable: boolean;
  callSummary: string | null;
  errorMessage: string | null;
  // Exact final price the agent recorded via record_negotiation_event, if any.
  recordedFinalCents: number | null;
}

export interface WorkflowState {
  workflowId: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
  stage: WorkflowStage;
  profile: Record<string, unknown> | null;
  confirmedRequest: ConfirmedQuoteRequest | null;
  research: {
    providers: ResearchProviderView[];
    evaluatedAt: string;
    live: boolean;
  } | null;
  ranking: ProviderRankingResult | null;
  quotes: QuoteView[] | null;
  recommendedQuoteId: string | null;
  handoff: NegotiationHandoff | null;
  negotiation: NegotiationResultView | null;
}

interface StoreGlobal {
  __psAccounts?: Map<string, Account>;
  __psWorkflows?: Map<string, WorkflowState>;
}

const storeGlobal = globalThis as unknown as StoreGlobal;
export const accounts: Map<string, Account> = (storeGlobal.__psAccounts ??= new Map());
export const workflows: Map<string, WorkflowState> = (storeGlobal.__psWorkflows ??= new Map());

export function getAccount(id: string): Account | undefined {
  return accounts.get(id);
}

export function getWorkflow(id: string): WorkflowState | undefined {
  return workflows.get(id);
}

export function createAccount(displayName: string, email: string): Account {
  const id = `acct_${randomUUID()}`;
  const workflowId = `wf_${randomUUID().replace(/-/g, "")}`;
  const now = new Date().toISOString();
  const account: Account = { id, displayName, email, createdAt: now, workflowId };
  accounts.set(id, account);
  workflows.set(workflowId, {
    workflowId,
    accountId: id,
    createdAt: now,
    updatedAt: now,
    stage: "profile",
    profile: null,
    confirmedRequest: null,
    research: null,
    ranking: null,
    quotes: null,
    recommendedQuoteId: null,
    handoff: null,
    negotiation: null,
  });
  return account;
}

export function touch(workflow: WorkflowState): void {
  workflow.updatedAt = new Date().toISOString();
}
