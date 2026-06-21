/// Gas station - sponsors user transactions so users never pay gas.
/// Co-signs transactions with the sponsor keypair after validation.
import { Router } from 'express';
import { z } from 'zod';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { gasStationQueue } from '../jobs/queues.js';

export const gasRouter = Router();

const suiClient = new SuiClient({
  url: getFullnodeUrl((process.env.SUI_NETWORK ?? 'testnet') as any),
});

const sponsorKeypair = Ed25519Keypair.fromSecretKey(
  Buffer.from(process.env.GAS_SPONSOR_PRIVATE_KEY!, 'hex'),
);

// POST /api/gas/sponsor - accepts serialized tx, validates, attaches gas + signature
gasRouter.post('/sponsor', async (req, res) => {
  const schema = z.object({
    userAddress: z.string().min(60),
    txBytes: z.string(), // base64 serialized Transaction
    txKind: z.enum(['deposit', 'withdraw', 'create_position']),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  const { userAddress, txBytes, txKind } = parsed.data;

  // Enqueue rate-limit check
  const job = await gasStationQueue.add('check', { userAddress, txKind });
  const result = await job.waitUntilFinished(
    gasStationQueue.events as any,
    10_000,
  ).catch(() => ({ approved: false })) as { approved: boolean };

  if (!result.approved) {
    res.status(429).json({ error: 'Gas station limit reached' });
    return;
  }

  try {
    // Deserialize the transaction and add sponsor signature
    const tx = Transaction.from(Buffer.from(txBytes, 'base64'));

    // Set gas owner to sponsor
    tx.setGasOwner(sponsorKeypair.getPublicKey().toSuiAddress());
    tx.setGasBudget(5_000_000);

    // Build the transaction bytes for dual-signing
    const builtTx = await tx.build({ client: suiClient });
    const sponsorSig = await sponsorKeypair.signTransaction(builtTx);

    res.json({
      txBytes: Buffer.from(builtTx).toString('base64'),
      sponsorSignature: sponsorSig.signature,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
