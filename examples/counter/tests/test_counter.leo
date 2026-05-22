import counter.aleo;

program test_counter.aleo {
    @test
    fn test_next() {
        assert_eq(counter.aleo::next(0u64), 1u64);
        assert_eq(counter.aleo::next(9u64), 10u64);
        assert_eq(counter.aleo::next(99u64), 100u64);
    }

    @test
    @should_fail
    fn test_next_wrong_value() {
        // next(5) = 6, not 99 — this assertion must fail.
        assert_eq(counter.aleo::next(5u64), 99u64);
    }

    @test
    fn test_increment() -> Final {
        let f: Final = counter.aleo::increment();
        return final {
            f.run();
            assert(counter.aleo::count.unwrap() == 1u64);
        };
    }

    @test
    fn test_increment_twice() -> Final {
        let f1: Final = counter.aleo::increment();
        let f2: Final = counter.aleo::increment();
        return final {
            f1.run();
            f2.run();
            assert(counter.aleo::count.unwrap() == 2u64);
        };
    }

    @test
    fn test_reset() -> Final {
        let f1: Final = counter.aleo::increment();
        let f2: Final = counter.aleo::reset();
        return final {
            f1.run();
            f2.run();
            assert(counter.aleo::count.unwrap_or(0u64) == 0u64);
        };
    }

    @noupgrade
    constructor() {}
}
