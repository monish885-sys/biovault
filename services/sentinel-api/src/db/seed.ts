import bcrypt from "bcrypt";
import { Types } from "mongoose";
import { createLogger } from "@biovault/common";
import { config } from "../config.js";
import { connectMongo, disconnectMongo } from "./connect.js";
import { ClientModel } from "./schemas/client.js";
import { TapeModel } from "./schemas/tape.js";
import { UserModel } from "./schemas/user.js";
import { seedDemoData } from "./seed-demo.js";
import "./schemas/index.js";

const log = createLogger("seed", config.logLevel);

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? "ChangeMe123!";
const SEED_DEMO = process.env.SEED_DEMO !== "0";

const SEED_USERS = [
  {
    email: "admin@acme.test",
    role: "client_admin" as const,
    clientSlug: "acme",
  },
  {
    email: "viewer@acme.test",
    role: "client_viewer" as const,
    clientSlug: "acme",
  },
  {
    email: "compliance@acme.test",
    role: "compliance_officer" as const,
    clientSlug: "acme",
  },
  {
    email: "ops@biovault.test",
    role: "ops_admin" as const,
  },
  {
    email: "tech@biovault.test",
    role: "technician" as const,
  },
];

async function main() {
  await connectMongo();
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const client = await ClientModel.findOneAndUpdate(
    { slug: "acme" },
    {
      $set: {
        name: "Acme Hospital",
        tier: "standard",
        retentionPolicyYears: 7,
        dataCategories: ["imaging", "lab_reports", "clinical"],
        onboardingComplete: true,
        active: true,
      },
      $setOnInsert: {
        slug: "acme",
      },
    },
    { upsert: true, new: true },
  );

  const seedTapes = [
    { barcode: "TAPE-ACME-001", rack: "R1", slot: "S01" },
    { barcode: "TAPE-ACME-002", rack: "R1", slot: "S02" },
    { barcode: "TAPE-ACME-003", rack: "R2", slot: "S01" },
    { barcode: "TAPE-ACME-004", rack: "R2", slot: "S02" },
  ];
  for (const tape of seedTapes) {
    await TapeModel.findOneAndUpdate(
      { barcode: tape.barcode },
      {
        $setOnInsert: {
          barcode: tape.barcode,
          rack: tape.rack,
          slot: tape.slot,
          status: "empty",
          fillPercent: 0,
          healthScore: "green",
          writeCycles: 0,
        },
      },
      { upsert: true },
    );
    log.info("tape ready", { barcode: tape.barcode, rack: tape.rack, slot: tape.slot });
  }

  for (const seed of SEED_USERS) {
    const clientId =
      "clientSlug" in seed && seed.clientSlug === "acme" ? client._id : undefined;
    await UserModel.findOneAndUpdate(
      { email: seed.email },
      {
        $set: {
          email: seed.email,
          passwordHash,
          role: seed.role,
          clientId,
          mfaEnabled: false,
          active: true,
        },
      },
      { upsert: true },
    );
    log.info("user ready", { email: seed.email, role: seed.role });
  }

  if (SEED_DEMO) {
    const admin = await UserModel.findOne({ email: "admin@acme.test" }).lean();
    const compliance = await UserModel.findOne({ email: "compliance@acme.test" }).lean();
    const tech = await UserModel.findOne({ email: "tech@biovault.test" }).lean();
    if (admin && compliance && tech) {
      await seedDemoData(client._id as Types.ObjectId, {
        clientAdminId: admin._id as Types.ObjectId,
        complianceId: compliance._id as Types.ObjectId,
        technicianId: tech._id as Types.ObjectId,
      });
    }
  }

  log.info("seed complete", {
    client: client.slug,
    demo: SEED_DEMO,
    password: config.nodeEnv === "production" ? "(set SEED_PASSWORD)" : DEFAULT_PASSWORD,
  });
  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
