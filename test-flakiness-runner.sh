#!/bin/bash
# Run V2 tests multiple times to detect flakiness

echo "V2 Test Flakiness Runner"
echo "========================"
echo "Will run tests up to 10 times or until a failure is detected"
echo ""

PASS_COUNT=0
FAIL_COUNT=0

for i in {1..10}; do
  echo "======================================"
  echo "Run #$i - $(date '+%Y-%m-%d %H:%M:%S')"
  echo "======================================"

  npm run test:v2 2>&1 | tee ~/tmp/v2test-run-$i.log

  EXIT_CODE=${PIPESTATUS[0]}

  if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ Run #$i PASSED"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo ""
    echo "❌ Run #$i FAILED (exit code: $EXIT_CODE)"
    FAIL_COUNT=$((FAIL_COUNT + 1))

    # Extract failure summary
    echo ""
    echo "Failure details:"
    tail -50 ~/tmp/v2test-run-$i.log

    # Stop on first failure to inspect
    echo ""
    echo "========================================"
    echo "STOPPING ON FIRST FAILURE"
    echo "Passed: $PASS_COUNT, Failed: $FAIL_COUNT"
    echo "Log saved to: ~/tmp/v2test-run-$i.log"
    echo "========================================"
    exit 1
  fi

  echo ""
done

echo ""
echo "========================================"
echo "ALL RUNS COMPLETED SUCCESSFULLY"
echo "Total runs: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "========================================"
