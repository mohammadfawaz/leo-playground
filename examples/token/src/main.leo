program token.aleo {
    record Token {
        owner: address,
        amount: u64,
    }

    // Public ledger — stores publicly visible balances.
    mapping public_balances: address => u64;

    // Mint a private token record.
    fn mint(public receiver: address, public amount: u64) -> Token {
        return Token { owner: receiver, amount: amount };
    }

    // Credit amount to receiver's public balance.
    fn mint_public(public receiver: address, public amount: u64) -> Final {
        return final {
            let current: u64 = Mapping::get_or_use(public_balances, receiver, 0u64);
            Mapping::set(public_balances, receiver, current + amount);
        };
    }

    // Transfer from the caller's public balance to receiver.
    fn transfer_public(public receiver: address, public amount: u64) -> Final {
        let sender: address = self.signer;
        return final {
            let bal: u64 = Mapping::get_or_use(public_balances, sender, 0u64);
            assert(bal >= amount);
            let recv_bal: u64 = Mapping::get_or_use(public_balances, receiver, 0u64);
            Mapping::set(public_balances, sender, bal - amount);
            Mapping::set(public_balances, receiver, recv_bal + amount);
        };
    }

    // Split a private token: returns (remainder for sender, amount for receiver).
    fn transfer(token: Token, public receiver: address, public amount: u64) -> (Token, Token) {
        assert(token.amount >= amount);
        let remaining: u64 = token.amount - amount;
        return (
            Token { owner: token.owner, amount: remaining },
            Token { owner: receiver,    amount: amount    },
        );
    }

    // Merge two private token records owned by the same address.
    fn merge(first: Token, second: Token) -> Token {
        assert_eq(first.owner, second.owner);
        return Token { owner: first.owner, amount: first.amount + second.amount };
    }

    // Read a public balance.
    view fn balance_of(addr: address) -> u64 {
        return public_balances.get_or_use(addr, 0u64);
    }

    @noupgrade
    constructor() {}
}
