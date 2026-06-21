import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const VAULT_ID = process.env.NEXT_PUBLIC_VAULT_ID!;
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!;

export interface UserPosition {
  objectId: string;
  shares: number;
  costBasis: number;
  riskTier: number;
  depositCount: number;
}

export async function fetchUserPosition(client: SuiClient, address: string): Promise<UserPosition | null> {
  const resp = await client.getOwnedObjects({
    owner: address,
    filter: { StructType: `${PACKAGE_ID}::vault::UserPosition` },
    options: { showContent: true },
  });

  const pos = resp.data.find((o) => {
    const fields = (o.data?.content as any)?.fields;
    return fields?.vault_id === VAULT_ID;
  });

  if (!pos?.data) return null;
  const fields = (pos.data.content as any)?.fields;
  return {
    objectId: pos.data.objectId,
    shares: Number(fields?.shares ?? 0),
    costBasis: Number(fields?.cost_basis ?? 0),
    riskTier: Number(fields?.risk_tier ?? 1),
    depositCount: Number(fields?.deposit_count ?? 0),
  };
}

export function buildDepositTx(
  amountMist: bigint,
  existingPositionId: string | null,
  riskTier: number,
  suiCoinObjectId: string,
  senderAddress: string,
): Transaction {
  const tx = new Transaction();
  const clockMs = Date.now();

  const [depositCoin] = tx.splitCoins(tx.object(suiCoinObjectId), [amountMist]);

  if (existingPositionId) {
    tx.moveCall({
      target: `${PACKAGE_ID}::vault::deposit`,
      typeArguments: ['0x2::sui::SUI'],
      arguments: [
        tx.object(VAULT_ID),
        tx.object(existingPositionId),
        depositCoin,
        tx.pure.u64(clockMs),
      ],
    });
  } else {
    const [newPos] = tx.moveCall({
      target: `${PACKAGE_ID}::vault::create_position`,
      arguments: [tx.object(VAULT_ID), tx.pure.u8(riskTier)],
    });

    tx.moveCall({
      target: `${PACKAGE_ID}::vault::deposit`,
      typeArguments: ['0x2::sui::SUI'],
      arguments: [
        tx.object(VAULT_ID),
        newPos,
        depositCoin,
        tx.pure.u64(clockMs),
      ],
    });

    tx.transferObjects([newPos], senderAddress);
  }

  tx.setGasBudget(50_000_000);
  return tx;
}
