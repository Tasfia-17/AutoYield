'use client';
import { ConnectButton } from '@mysten/dapp-kit';

export function WalletButton() {
  return (
    <ConnectButton
      connectText="Connect Wallet"
      className="!font-display !text-sm !rounded-xl !px-4 !py-2"
      style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'white', border: 'none' }}
    />
  );
}
