program vote.aleo {
    mapping agree_votes: u8 => u64;
    mapping disagree_votes: u8 => u64;

    fn agree(public id: u8) -> Final {
        return final {
            let current: u64 = Mapping::get_or_use(agree_votes, id, 0u64);
            Mapping::set(agree_votes, id, current + 1u64);
        };
    }

    fn disagree(public id: u8) -> Final {
        return final {
            let current: u64 = Mapping::get_or_use(disagree_votes, id, 0u64);
            Mapping::set(disagree_votes, id, current + 1u64);
        };
    }

    @noupgrade
    constructor() {}
}
