import token.aleo;

program test_token.aleo {
    @test
    fn test_mint_private() {
        let tok: token.aleo::Token = token.aleo::mint(self.signer, 100u64);
        assert_eq(tok.owner, self.signer);
        assert_eq(tok.amount, 100u64);
    }

    @test
    fn test_transfer_private() {
        let tok: token.aleo::Token = token.aleo::mint(self.signer, 100u64);
        let receiver: address = aleo10qerras5799u6k7rjtc9y3hcwxuykr45qra7x7dp6jgnc0923czqm0lgta;
        let (remaining, sent): (token.aleo::Token, token.aleo::Token) = token.aleo::transfer(tok, receiver, 30u64);
        assert_eq(remaining.amount, 70u64);
        assert_eq(remaining.owner, self.signer);
        assert_eq(sent.amount, 30u64);
        assert_eq(sent.owner, receiver);
    }

    @test
    fn test_merge() {
        let tok1: token.aleo::Token = token.aleo::mint(self.signer, 40u64);
        let tok2: token.aleo::Token = token.aleo::mint(self.signer, 60u64);
        let merged: token.aleo::Token = token.aleo::merge(tok1, tok2);
        assert_eq(merged.amount, 100u64);
        assert_eq(merged.owner, self.signer);
    }

    @test
    fn test_split_and_merge() {
        // Transfer to self splits into two self-owned chunks; merge them back.
        let tok: token.aleo::Token = token.aleo::mint(self.signer, 100u64);
        let (chunk_a, chunk_b): (token.aleo::Token, token.aleo::Token) = token.aleo::transfer(tok, self.signer, 40u64);
        assert_eq(chunk_a.amount, 60u64);
        assert_eq(chunk_b.amount, 40u64);
        let whole: token.aleo::Token = token.aleo::merge(chunk_a, chunk_b);
        assert_eq(whole.amount, 100u64);
    }

    // End-to-end: mint publicly, transfer, then verify both balances update atomically.
    @test
    fn test_public_ledger() -> Final {
        let me: address = self.signer;
        let receiver: address = aleo10qerras5799u6k7rjtc9y3hcwxuykr45qra7x7dp6jgnc0923czqm0lgta;
        let f_mint: Final = token.aleo::mint_public(me, 100u64);
        let f_transfer: Final = token.aleo::transfer_public(receiver, 30u64);
        return final {
            f_mint.run();
            f_transfer.run();
            let sender_bal: u64 = token.aleo::balance_of(me);
            let receiver_bal: u64 = token.aleo::balance_of(receiver);
            assert_eq(sender_bal, 70u64);
            assert_eq(receiver_bal, 30u64);
        };
    }

    @test
    @should_fail
    fn test_overdraft_private() {
        // Spending more than balance must fail.
        let tok: token.aleo::Token = token.aleo::mint(self.signer, 50u64);
        let receiver: address = aleo10qerras5799u6k7rjtc9y3hcwxuykr45qra7x7dp6jgnc0923czqm0lgta;
        token.aleo::transfer(tok, receiver, 100u64);
    }

    @test
    @should_fail
    fn test_overdraft_public() -> Final {
        // Transferring more than the public balance must fail in finalize.
        let receiver: address = aleo10qerras5799u6k7rjtc9y3hcwxuykr45qra7x7dp6jgnc0923czqm0lgta;
        let f_mint: Final = token.aleo::mint_public(self.signer, 50u64);
        let f_transfer: Final = token.aleo::transfer_public(receiver, 100u64);
        return final {
            f_mint.run();
            f_transfer.run();
        };
    }

    @noupgrade
    constructor() {}
}
