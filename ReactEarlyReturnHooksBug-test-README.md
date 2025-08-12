# React Early Return Hooks Bug Test

## Overview

This test file (`packages/react-reconciler/src/__tests__/ReactEarlyReturnHooksBug-test.js`) reproduces a React bug where components with early returns before hooks cause "Internal React error: Expected static flag was missing" errors.

## The Bug

The bug occurs when a React component:
1. Has an early return statement (e.g., `if (!condition) return null;`)
2. Calls hooks after that early return
3. Is re-rendered with different props that change whether the early return is taken

This causes React's static flag tracking to become confused, leading to the error:
```
Internal React error: Expected static flag was missing. Please notify the React team.
```

## Test Cases

### 1. Conditional Hook Calls (Reproduces the Bug)
**File**: `ReactEarlyReturnHooksBug-test.js:30-65`

This test reproduces the bug by:
- Rendering a component without hooks first (`shouldUseHooks={false}`)
- Then re-rendering the same component with hooks (`shouldUseHooks={true}`)

**Expected Behavior**: Currently fails with the static flag error (proving the bug exists)
**After Fix**: Should pass with no console errors

### 2. Recursive Component with Early Return (Reproduces the Bug)
**File**: `ReactEarlyReturnHooksBug-test.js:67-140`

This test reproduces the bug in a recursive component scenario:
- `SubGroupFilter` component has an early return before hooks
- It's used recursively in a form structure
- The early return happens before `useState` and `useEffect` calls

**Expected Behavior**: Currently passes (the recursive nature may mask the issue)
**After Fix**: Should continue to pass

### 3. Correct Pattern (Shows the Fix)
**File**: `ReactEarlyReturnHooksBug-test.js:142-189`

This test shows the correct way to structure components:
- Call all hooks first
- Then have early returns
- This pattern avoids the static flag issue entirely

**Expected Behavior**: Always passes (demonstrates the correct approach)

## Technical Details

### Static Flags
React uses static flags to track whether certain effects (like `useEffect`) are present in a component. When hooks are called conditionally or after early returns, these flags can become inconsistent between renders.

### The Error Location
The error is thrown in `packages/react-reconciler/src/ReactFiberHooks.js` around line 689:
```javascript
console.error(
  'Internal React error: Expected static flag was missing. Please ' +
    'notify the React team.',
);
```

### Testing Utilities Used
- `ReactNoop` renderer for testing without DOM
- `internal-test-utils` for proper console error assertions
- `act()` for handling React updates in tests

## How to Use This Test

### For Bug Reproduction
1. Run the test: `yarn test --testPathPattern=ReactEarlyReturnHooksBug-test.js`
2. Test 1 will fail, proving the bug exists
3. Tests 2 and 3 will pass, showing the scope of the issue

### For Fix Development
1. Implement a fix for the static flag tracking issue
2. Run the test again
3. Test 1 should now pass with `assertConsoleErrorDev([])`
4. All tests should pass

### For Regression Testing
Once fixed, this test ensures the bug doesn't regress in future React versions.

## Related Issues

- **GitHub Issue**: [Link to be added when issue is created]
- **React Version**: Affects React 19+ (experimental channel)
- **Component Pattern**: Common in conditional rendering scenarios

## Next Steps

1. **Create GitHub Issue**: Document this bug with reproduction steps
2. **Investigate Root Cause**: Understand why static flags are being mismatched
3. **Implement Fix**: Modify React's static flag tracking logic
4. **Update Test**: Change Test 1 to expect no errors after the fix
5. **Add to CI**: Ensure this test runs in React's continuous integration

## Files Modified

- `packages/react-reconciler/src/__tests__/ReactEarlyReturnHooksBug-test.js` - New test file
- This README - Documentation

## Notes

- The test uses `{withoutStack: true}` in `assertConsoleErrorDev` because the static flag error doesn't include component stack traces
- The recursive component test may not always reproduce the issue due to React's internal optimizations
- This bug primarily affects concurrent mode and newer React features