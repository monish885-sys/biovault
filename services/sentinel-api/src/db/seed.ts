import bcrypt from "bcrypt";
import { createLogger } from "@biovault/common";
import { config } from "../config.js";
import { connectMongo, disconnectMongo } from "./connect.js";
import { ClientModel } from "./schemas/client.js";
import { UserModel } from "./schemas/user.js";
import "./schemas/index.js";

const log = createLogger("seed", config.logLevel);

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? "ChangeMe123!";

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
      $setOnInsert: {
        name: "Acme Hospital",
        slug: "acme",
        tier: "standard",
        retentionPolicyYears: 7,
        dataCategories: ["imaging", "lab_reports"],
        onboardingComplete: false,
        active: true,
      },
    },
    { upsert: true, new: true },
  );

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

  log.info("seed complete", {
    client: client.slug,
    password: config.nodeEnv === "production" ? "(set SEED_PASSWORD)" : DEFAULT_PASSWORD,
  });
  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
