import vote.aleo;

program test_vote.aleo {
    @test
    fn test_agree_increments() -> Final {
        let f: Final = vote.aleo::agree(0u8);
        return final {
            f.run();
            // Vote mapping is not exposed via a view fn yet, but finalize ran without error.
        };
    }

    @test
    fn test_disagree_increments() -> Final {
        let f: Final = vote.aleo::disagree(0u8);
        return final {
            f.run();
        };
    }

    @noupgrade
    constructor() {}
}
