import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const store = vi.hoisted(() => ({
  job: null as Record<string, unknown> | null,
  auditEvents: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../db/schemas/retrieval-job.js", () => ({
  RetrievalJobModel: {
    findById: vi.fn((id: string) => ({
      lean: vi.fn(async () =>
        store.job && String(store.job._id) === String(id) ? store.job : null,
      ),
    })),
  },
}));

vi.mock("../audit/audit.service.js", () => ({
  recordAuditEvent: vi.fn(async (params: Record<string, unknown>) => {
    store.auditEvents.push(params);
  }),
}));

vi.mock("bullmq", () => ({
  Worker: vi.fn(function WorkerMock(
    this: {
      callback: (job: { name: string; data: { retrievalJobId: string } }) => Promise<void>;
    },
    _name: string,
    callback: (job: { name: string; data: { retrievalJobId: string } }) => Promise<void>,
  ) {
    this.callback = callback;
    return { on: vi.fn(), close: vi.fn() };
  }),
}));

vi.mock("../../config.js", () => ({
  config: { redisUrl: "redis://localhost:6379", logLevel: "error" },
}));

import { Worker } from "bullmq";
import { startRetrievalWorker, stopRetrievalWorker } from "./retrieval.worker.js";

function getWorkerCallback(): (
  job: { name: string; data: { retrievalJobId: string } },
) => Promise<void> {
  const workerInstance = vi.mocked(Worker).mock.instances.at(-1) as unknown as {
    callback: (job: { name: string; data: { retrievalJobId: string } }) => Promise<void>;
  };
  return workerInstance.callback;
}

describe("retrieval unassigned alert worker", () => {
  beforeEach(async () => {
    store.job = null;
    store.auditEvents = [];
    await stopRetrievalWorker();
    vi.clearAllMocks();
  });

  it("records audit when job is still pending and unassigned", async () => {
    const jobId = new Types.ObjectId();
    store.job = {
      _id: jobId,
      clientId: new Types.ObjectId(),
      fileId: new Types.ObjectId(),
      status: "pending",
      dueAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    startRetrievalWorker();
    await getWorkerCallback()({
      name: "unassigned-alert",
      data: { retrievalJobId: String(jobId) },
    });

    expect(store.auditEvents).toHaveLength(1);
    expect(store.auditEvents[0].action).toBe("retrieval.unassigned_alert");
  });

  it("skips alert when job is already assigned", async () => {
    const jobId = new Types.ObjectId();
    store.job = {
      _id: jobId,
      clientId: new Types.ObjectId(),
      fileId: new Types.ObjectId(),
      status: "pending",
      assignedTo: new Types.ObjectId(),
      dueAt: new Date(),
    };

    startRetrievalWorker();
    await getWorkerCallback()({
      name: "unassigned-alert",
      data: { retrievalJobId: String(jobId) },
    });

    expect(store.auditEvents).toHaveLength(0);
  });
});
