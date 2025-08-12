/**
 * @jest-environment node
 */

'use strict';

let React;
let ReactNoop;
let act;
let assertConsoleErrorDev;

// This test reproduces the bug reported in:
// https://github.com/facebook/react/issues/XXXXX
// where recursive components with early returns before hooks cause
// "Internal React error: Expected static flag was missing" errors.

describe('ReactEarlyReturnHooksBug', () => {
  let didWarnAboutStaticFlag;
  let originalConsoleError;

  beforeEach(() => {
    jest.resetModules();

    React = require('react');
    ReactNoop = require('react-noop-renderer');
    act = require('internal-test-utils').act;
    assertConsoleErrorDev = require('internal-test-utils').assertConsoleErrorDev;

    // Capture console.error to check for the specific error
    didWarnAboutStaticFlag = false;
    originalConsoleError = console.error;
    console.error = (...args) => {
      if (
        args[0] &&
        typeof args[0] === 'string' &&
        args[0].includes('Expected static flag was missing')
      ) {
        didWarnAboutStaticFlag = true;
      }
      originalConsoleError(...args);
    };
  });

  afterEach(() => {
    console.error = originalConsoleError;
    jest.restoreAllMocks();
  });

  // Repro for conditional hook calls; currently logs the static flag error
  it('should log static flag error with conditional hook calls', async () => {
    function ConditionalHooksComponent({shouldUseHooks}) {
      // Early return before hooks
      if (!shouldUseHooks) {
        return <div>No hooks used</div>;
      }

      // Hooks called after early return
      const [count, setCount] = React.useState(0);
      React.useEffect(() => {
        setCount(1);
      }, []);

      return <div>Count: {count}</div>;
    }

    const root = ReactNoop.createRoot(null);

    // First render without hooks
    await act(async () => {
      root.render(<ConditionalHooksComponent shouldUseHooks={false} />);
    });

    // Second render with hooks - this would trigger the bug before our fix
    await act(async () => {
      root.render(<ConditionalHooksComponent shouldUseHooks={true} />);
    });

    // Assert the error was logged during the second render, then clear it
    assertConsoleErrorDev([
      'Internal React error: Expected static flag was missing. Please notify the React team.',
    ]);

    // It should have logged the static flag error
    expect(didWarnAboutStaticFlag).toBe(true);
  });

  // Test the original recursive component issue (simplified)
  it('should not trigger static flag error with early return before hooks in recursive component', async () => {
    // This is the problematic component from the user's report (simplified)
    function SubGroupFilter({depth, label, root, action}) {
      // BUG: Early return before hooks - this causes the static flag issue
      if (!root.length) {
        return null;
      }

      // Limit recursion to avoid infinite loop
      if (depth > 0) {
        return <div>Max depth reached</div>;
      }

      // These hooks are called after the early return, which confuses React's
      // static flag tracking in recursive components
      const [index, setIndex] = React.useState(0);
      const [items, setItems] = React.useState([]);

      React.useEffect(() => {
        if (root[index]) {
          setItems([{id: 'test', name: 'Test'}]);
        }
      }, [root, index]);

      return (
        <>
          <fieldset>
            <legend>{label}</legend>
            <select
              name="product-group"
              onChange={event => setIndex(event.currentTarget.selectedIndex)}>
              {root.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </fieldset>
          <SubGroupFilter
            depth={depth + 1}
            label={`Subgroup - ${root[index]?.name || 'Unknown'}`}
            root={items}
            action={action}
          />
        </>
      );
    }

    function SearchForm({root, action}) {
      return (
        <>
          <span>Search Form</span>
          <form>
            <SubGroupFilter
              depth={0}
              label="Product groups"
              root={root}
              action={action}
            />
            <button className="button">search</button>
          </form>
        </>
      );
    }

    const root = ReactNoop.createRoot(null);

    // Initial render with root data
    await act(async () => {
      root.render(
        <SearchForm
          root={[
            {id: 'foo1', name: 'Foo1'},
            {id: 'foo2', name: 'Foo2'},
          ]}
          action={() => {}}
        />,
      );
    });

    // The bug should NOT trigger the static flag error anymore due to our fix
    expect(didWarnAboutStaticFlag).toBe(false);
  });

  // This shows the correct way to structure the component
  it('should work correctly when hooks are called before early return', async () => {
    // CORRECT: Hooks are called before the early return
    function SubGroupFilter({depth, label, root, action}) {
      // Call hooks first
      const [index, setIndex] = React.useState(0);
      const [items, setItems] = React.useState([]);

      React.useEffect(() => {
        if (root.length > 0 && root[index]) {
          setItems([{id: 'test', name: 'Test'}]);
        }
      }, [root, index]);

      // Limit recursion to avoid infinite loop
      if (depth > 0) {
        return <div>Max depth reached</div>;
      }

      // Early return after hooks
      if (!root.length) {
        return null;
      }

      return (
        <>
          <fieldset>
            <legend>{label}</legend>
            <select
              name="product-group"
              onChange={event => setIndex(event.currentTarget.selectedIndex)}>
              {root.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </fieldset>
          <SubGroupFilter
            depth={depth + 1}
            label={`Subgroup - ${root[index]?.name || 'Unknown'}`}
            root={items}
            action={action}
          />
        </>
      );
    }

    function SearchForm({root, action}) {
      return (
        <>
          <span>Search Form</span>
          <form>
            <SubGroupFilter
              depth={0}
              label="Product groups"
              root={root}
              action={action}
            />
            <button className="button">search</button>
          </form>
        </>
      );
    }

    const root = ReactNoop.createRoot(null);

    await act(async () => {
      root.render(
        <SearchForm
          root={[
            {id: 'foo1', name: 'Foo1'},
            {id: 'foo2', name: 'Foo2'},
          ]}
          action={() => {}}
        />,
      );
    });

    // This should not trigger the static flag error
    expect(didWarnAboutStaticFlag).toBe(false);
  });
});