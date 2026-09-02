import { describe, expect, it, vi } from "vitest";
import {
  issueThreadInteractionService,
  STALE_INTERACTION_THRESHOLD_MS,
} from "./issue-thread-interactions.js";

const createdAt = new Date("2026-08-01T00:00:00.000Z");
const interaction = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: "22222222-2222-4222-8222-222222222222",
  issueId: "33333333-3333-4333-8333-333333333333",
  kind: "request_confirmation",
  status: "pending",
  continuationPolicy: "wake_assignee",
  requestedResolverPolicy: "human_only",
  effectiveResolverPolicy: "human_only",
  resolverPolicyProvenance: "explicit",
  effectiveResolverPolicySource: "requested",
  idempotencyKey: null,
  sourceCommentId: null,
  sourceRunId: null,
  title: "Choose rollout timing",
  summary: null,
  createdByAgentId: "44444444-4444-4444-8444-444444444444",
  addresseeAgentId: null,
  createdByUserId: null,
  resolvedByAgentId: null,
  resolvedByRunId: null,
  resolvedByUserId: null,
  payload: { version: 1, prompt: "Launch now?", supersedeOnUserComment: true },
  result: null,
  resolvedAt: null,
  escalatedAt: new Date("2026-08-08T00:00:00.000Z"),
  createdAt,
  updatedAt: createdAt,
};

function selectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => Promise.resolve(rows)),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return chain;
}

describe("stale issue-thread interaction aging", () => {
  it("documents a seven-day threshold", () => {
    expect(STALE_INTERACTION_THRESHOLD_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("lists old pending cards with age, issue, blocker, creator, and resolver policy", async () => {
    const db: any = {
      select: vi.fn()
        .mockReturnValueOnce(selectChain([{
          interaction,
          issueId: interaction.issueId,
          issueIdentifier: "PSG-1115",
          issueTitle: "Waiting on a business decision",
          issueStatus: "blocked",
        }]))
        .mockReturnValueOnce(selectChain([{
          blockedIssueId: interaction.issueId,
          id: "55555555-5555-4555-8555-555555555555",
          identifier: "PSG-1089",
          title: "Choose the launch date",
          status: "in_review",
        }])),
    };

    const [result] = await issueThreadInteractionService(db).listStalePendingForCompany(
      interaction.companyId,
      new Date("2026-08-10T00:00:00.000Z"),
    );

    expect(result.ageDays).toBe(9);
    expect(result.issue).toEqual({
      id: interaction.issueId,
      identifier: "PSG-1115",
      title: "Waiting on a business decision",
      status: "blocked",
      blockedBy: [{
        id: "55555555-5555-4555-8555-555555555555",
        identifier: "PSG-1089",
        title: "Choose the launch date",
        status: "in_review",
      }],
    });
    expect(result.interaction.createdByAgentId).toBe(interaction.createdByAgentId);
    expect(result.interaction.effectiveResolverPolicy).toBe("human_only");
    expect(result.interaction.escalatedAt).toEqual(interaction.escalatedAt);
  });

  it("stamps each stale pending card only once", async () => {
    const returning = vi.fn()
      .mockResolvedValueOnce([{ id: interaction.id }])
      .mockResolvedValueOnce([]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const db: any = { update: vi.fn(() => ({ set })) };
    const service = issueThreadInteractionService(db);
    const at = new Date("2026-08-10T00:00:00.000Z");

    await expect(service.escalateStalePending(at)).resolves.toEqual({
      escalated: 1,
      interactionIds: [interaction.id],
    });
    await expect(service.escalateStalePending(at)).resolves.toEqual({
      escalated: 0,
      interactionIds: [],
    });
    expect(set).toHaveBeenCalledWith({ escalatedAt: at });
  });
});
