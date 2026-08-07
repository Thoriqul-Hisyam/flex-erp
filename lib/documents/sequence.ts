import { db, schema } from "@/db";
import { sql } from "drizzle-orm";

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Atomically allocates the next running number for a document prefix,
 * scoped per company and per calendar month (matching the existing
 * "PREFIX-YYYYMM-0001" numbering convention). Backed by an upsert against
 * `document_sequences`, so concurrent requests never observe the same
 * sequence number even without an application-level lock.
 */
export async function nextDocumentNumber(
  tx: TxClient,
  params: { tenantId: string; companyId: string; prefix: string },
): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
  const docType = `${params.prefix}-${dateStr}`;

  const [row] = await tx
    .insert(schema.documentSequences)
    .values({
      tenantId: params.tenantId,
      companyId: params.companyId,
      docType,
      seq: 1,
    })
    .onConflictDoUpdate({
      target: [schema.documentSequences.companyId, schema.documentSequences.docType],
      set: {
        seq: sql`${schema.documentSequences.seq} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ seq: schema.documentSequences.seq });

  return `${params.prefix}-${dateStr}-${String(row.seq).padStart(4, "0")}`;
}
