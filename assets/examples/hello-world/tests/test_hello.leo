import hello.aleo;

program test_hello.aleo {
    @test
    fn test_sum() {
        assert_eq(hello.aleo::sum(3u32, 4u32), 7u32);
        assert_eq(hello.aleo::sum(0u32, 100u32), 100u32);
        assert_eq(hello.aleo::sum(1u32, 1u32), 2u32);
    }

    @test
    fn test_maximum() {
        assert_eq(hello.aleo::maximum(5u32, 3u32), 5u32);
        assert_eq(hello.aleo::maximum(2u32, 9u32), 9u32);
        assert_eq(hello.aleo::maximum(6u32, 6u32), 6u32);
    }

    @test
    fn test_divisibility() {
        assert(hello.aleo::is_divisible_by(12u32, 3u32));
        assert(!hello.aleo::is_divisible_by(7u32, 3u32));
        assert(hello.aleo::is_divisible_by(100u32, 10u32));
    }

    @test
    @should_fail
    fn test_wrong_sum() {
        // 3 + 4 = 7, not 8 — this assertion must fail.
        assert_eq(hello.aleo::sum(3u32, 4u32), 8u32);
    }

    @noupgrade
    constructor() {}
}
