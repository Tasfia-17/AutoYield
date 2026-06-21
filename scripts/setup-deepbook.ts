/// setup-deepbook.ts — Creates a DeepBook BalanceManager and mints TradeCap for the agent.
/// Run after deploy.sh: pnpm tsx scripts/setup-deepbook.ts
import 'dotenv/config';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { DeepBookClient } from '@mysten/deepbook-v3';
import { Transaction } from '@mysten/sui/transactions';

const NETWORK = (process.env.SUI_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

async function main() {
  const suiClient = new SuiClient({ url: getFullnodeUrl(NETWORK) });
  const keypair = Ed25519Keypair.fromSecretKey(
    Buffer.from(process.env.AGENT_PRIVATE_KEY!, 'hex'),
  );
  const address = keypair.getPublicKey().toSuiAddress();
  console.log('Setting up DeepBook for address:', address);

  const deepbookClient = new DeepBookClient({
    client: suiClient,
    address,
  });

  // Step 1: Create and share a BalanceManager
  const tx = new Transaction();
  tx.add(deepbookClient.balanceManager.createAndShareBalanceManager());
  tx.setGasBudget(50_000_000);

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showObjectChanges: true },
  });

  const managerObj = result.objectChanges?.find(
    (c) => c.type === 'created' && (c as any).objectType?.includes('BalanceManager'),
  ) as any;
  const managerId = managerObj?.objectId ?? '';
  console.log('✅ BalanceManager created:', managerId);

  // Step 2: Mint TradeCap for agent
  const tx2 = new Transaction();
  tx2.add(deepbookClient.balanceManager.mintTradeCap('MANAGER_1'));
  tx2.setGasBudget(20_000_000);

  const result2 = await suiClient.signAndExecuteTransaction({
    transaction: tx2,
    signer: keypair,
    options: { showObjectChanges: true },
  });

  const tradeCapObj = result2.objectChanges?.find(
    (c) => c.type === 'created' && (c as any).objectType?.includes('TradeCap'),
  ) as any;
  const tradeCapId = tradeCapObj?.objectId ?? '';
  console.log('✅ TradeCap minted:', tradeCapId);

  console.log('\nAdd to .env:');
  console.log(`DEEPBOOK_MANAGER_ID=${managerId}`);
  console.log(`DEEPBOOK_TRADE_CAP_ID=${tradeCapId}`);
}

main().catch(console.error);
