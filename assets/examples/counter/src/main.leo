program counter.aleo {
    // On-chain counter — a single persistent u64 value.
    storage count: u64;

    // Returns n + 1 (pure computation, no on-chain effect).
    fn next(public n: u64) -> u64 {
        return n + 1u64;
    }

    // Increments the on-chain counter by 1.
    fn increment() -> Final {
        return final {
            count = count.unwrap_or(0u64) + 1u64;
        };
    }

    // Resets the counter to zero.
    fn reset() -> Final {
        return final {
            count = none;
        };
    }

    @noupgrade
    constructor() {}
}
