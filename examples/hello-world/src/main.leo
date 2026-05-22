program hello.aleo {
    // Returns the sum of two numbers.
    fn sum(public a: u32, public b: u32) -> u32 {
        return a + b;
    }

    // Returns the larger of two values.
    fn maximum(public a: u32, public b: u32) -> u32 {
        if a >= b {
            return a;
        } else {
            return b;
        }
    }

    // Returns true when n is evenly divisible by d.
    fn is_divisible_by(public n: u32, public d: u32) -> bool {
        return n % d == 0u32;
    }

    @noupgrade
    constructor() {}
}
