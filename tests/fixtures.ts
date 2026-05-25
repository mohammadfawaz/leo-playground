// Per-example invocation data for the Run panel and expected test outcomes.
// Function names and inputs match the seeded example sources under assets/examples/.

export type ExampleFixture = {
  displayName: string;
  slug: string;
  programName: string;        // e.g. "hello.aleo"
  runFn: string;              // a function present in main.leo
  runInputs: string[];        // textual inputs for that function (Leo-typed)
  expectedRunSubstring: string;
  // Test names (short, no `program/`) that must report `passed` after Run All.
  expectedPassingTests: string[];
};

// Well-known valid test address (taken from the Token example's own tests).
const TEST_ADDR = 'aleo10qerras5799u6k7rjtc9y3hcwxuykr45qra7x7dp6jgnc0923czqm0lgta';

export const EXAMPLES: ExampleFixture[] = [
  {
    displayName: 'Hello World',
    slug: 'hello-world',
    programName: 'hello.aleo',
    runFn: 'sum',
    runInputs: ['3u32', '4u32'],
    expectedRunSubstring: '7u32',
    expectedPassingTests: [
      'test_sum',
      'test_maximum',
      'test_divisibility',
      'test_wrong_sum', // @should_fail — passing means the assertion did fail
    ],
  },
  {
    displayName: 'Counter',
    slug: 'counter',
    programName: 'counter.aleo',
    runFn: 'next',
    runInputs: ['9u64'],
    expectedRunSubstring: '10u64',
    expectedPassingTests: [
      'test_next',
      'test_next_wrong_value',
      'test_increment',
      'test_increment_twice',
      'test_reset',
    ],
  },
  {
    displayName: 'Token',
    slug: 'token',
    programName: 'token.aleo',
    runFn: 'mint',
    runInputs: [TEST_ADDR, '42u64'],
    expectedRunSubstring: 'amount: 42u64',
    expectedPassingTests: [
      'test_mint_private',
      'test_transfer_private',
      'test_merge',
      'test_split_and_merge',
      'test_public_ledger',
      'test_overdraft_private',
      'test_overdraft_public',
    ],
  },
  {
    displayName: 'Vote',
    slug: 'vote',
    programName: 'vote.aleo',
    runFn: 'agree',
    runInputs: ['1u8'],
    expectedRunSubstring: 'agree_votes',
    expectedPassingTests: [
      'test_agree_increments',
      'test_disagree_increments',
    ],
  },
];

// A minimal "new project" — self-contained program with one fn and tests.
// Function name avoids reserved Aleo opcodes (double, square, abs, etc.).
export const NEW_PROJECT = {
  programName: 'demo.aleo',
  source: `program demo.aleo {
    fn triple(public n: u32) -> u32 {
        return n + n + n;
    }

    @noupgrade
    constructor() {}
}
`,
  programJson: JSON.stringify(
    { program: 'demo.aleo', version: '0.0.0', description: '', license: 'MIT' },
    null,
    2,
  ),
  testSource: `import demo.aleo;

program test_demo.aleo {
    @test
    fn test_triple_basic() {
        assert_eq(demo.aleo::triple(2u32), 6u32);
    }

    @test
    fn test_triple_zero() {
        assert_eq(demo.aleo::triple(0u32), 0u32);
    }

    @test
    @should_fail
    fn test_triple_wrong() {
        assert_eq(demo.aleo::triple(3u32), 7u32);
    }

    @noupgrade
    constructor() {}
}
`,
  runFn: 'triple',
  runInputs: ['7u32'],
  expectedRunSubstring: '21u32',
  expectedPassingTests: ['test_triple_basic', 'test_triple_zero', 'test_triple_wrong'],
};
