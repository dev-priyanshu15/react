/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 * @jest-environment node
 */

'use strict';

let React;
let ReactNoop;
let Scheduler;
let act;
let waitForAll;
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
    Scheduler = require('scheduler');
    
    const InternalTestUtils = require('internal-test-utils');
    act = InternalTestUtils.act;
    waitForAll = InternalTestUtils.waitForAll;
    assertConsoleErrorDev = InternalTestUtils.assertConsoleErrorDev;
    
    // Capture console.error to check for the specific error
    didWarnAboutStaticFlag = false;
    originalConsoleError = console.error;
    console.error = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('Expected static flag was missing')) {
        didWarnAboutStaticFlag = true;
      }
      originalConsoleError(...args);
    };
  });

  afterEach(() => {
    console.error = originalConsoleError;
    jest.restoreAllMocks();
  });

  // Simple test to reproduce the static flag error with conditional hook calls
  it('reproduces static flag error with conditional hook calls', async () => {
    function ConditionalHooksComponent({ shouldUseHooks }) {
      // Early return before hooks
      if (!shouldUseHooks) {
        return React.createElement('div', null, 'No hooks used');
      }

      // Hooks called after early return
      const [count, setCount] = React.useState(0);
      React.useEffect(() => {
        setCount(1);
      }, []);

      return React.createElement('div', null, `Count: ${count}`);
    }

    const root = ReactNoop.createRoot();

    // First render without hooks
    await act(async () => {
      root.render(React.createElement(ConditionalHooksComponent, { shouldUseHooks: false }));
    });

    // Second render with hooks - this triggers the bug
    await act(async () => {
      root.render(React.createElement(ConditionalHooksComponent, { shouldUseHooks: true }));
    });

    // Expect the console error to be logged
    assertConsoleErrorDev([
      'Internal React error: Expected static flag was missing. Please notify the React team.'
    ]);

    // The bug DOES trigger the static flag error (this test documents the current buggy behavior)
    expect(didWarnAboutStaticFlag).toBe(true);
  });

  // Test the original recursive component issue (simplified)
  it('reproduces static flag error with early return before hooks in recursive component', async () => {
    // This is the problematic component from the user's report (simplified)
    function SubGroupFilter({ depth, label, root, action }) {
      // BUG: Early return before hooks - this causes the static flag issue
      if (!root.length) {
        return null;
      }

      // Limit recursion to avoid infinite loop
      if (depth > 2) {
        return React.createElement('div', null, 'Max depth reached');
      }

      // These hooks are called after the early return, which confuses React's
      // static flag tracking in recursive components
      const [index, setIndex] = React.useState(0);
      const [items, setItems] = React.useState([]);

      React.useEffect(() => {
        if (root[index]) {
          setItems([{ id: 'test', name: 'Test' }]);
        }
      }, [root, index]);

      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'fieldset',
          null,
          React.createElement('legend', null, label),
          React.createElement(
            'select',
            {
              name: 'product-group',
              onChange: event => setIndex(event.currentTarget.selectedIndex)
            },
            root.map(item =>
              React.createElement('option', { key: item.id, value: item.id }, item.name)
            )
          )
        ),
        React.createElement(SubGroupFilter, {
          depth: depth + 1,
          label: `Subgroup - ${root[index]?.name || 'Unknown'}`,
          root: items,
          action: action
        })
      );
    }

    function SearchForm({ root, action }) {
      return React.createElement(
        React.Fragment,
        null,
        React.createElement('span', null, 'Search Form'),
        React.createElement(
          'form',
          null,
          React.createElement(SubGroupFilter, {
            depth: 0,
            label: 'Product groups',
            root: root,
            action: action
          }),
          React.createElement('button', { className: 'button' }, 'search')
        )
      );
    }

    const root = ReactNoop.createRoot();

    // Initial render with root data
    await act(async () => {
      root.render(
        React.createElement(SearchForm, {
          root: [
            { id: "foo1", name: "Foo1" },
            { id: "foo2", name: "Foo2" }
          ],
          action: () => {}
        })
      );
    });

    // Expect the console errors to be logged for the recursive component
    assertConsoleErrorDev([
      'Internal React error: Expected static flag was missing. Please notify the React team.',
      'Internal React error: Expected static flag was missing. Please notify the React team.'
    ]);

    // The bug DOES trigger the static flag error (this test documents the current buggy behavior)
    expect(didWarnAboutStaticFlag).toBe(true);
  });

  // This shows the correct way to structure the component to avoid the bug
  it('does not trigger static flag error when hooks are called before early return', async () => {
    // CORRECT: Hooks are called before the early return
    function SubGroupFilter({ depth, label, root, action }) {
      // Call hooks first
      const [index, setIndex] = React.useState(0);
      const [items, setItems] = React.useState([]);

      React.useEffect(() => {
        if (root.length > 0 && root[index]) {
          setItems([{ id: 'test', name: 'Test' }]);
        }
      }, [root, index]);

      // Limit recursion to avoid infinite loop
      if (depth > 2) {
        return React.createElement('div', null, 'Max depth reached');
      }

      // Early return after hooks
      if (!root.length) {
        return null;
      }

      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'fieldset',
          null,
          React.createElement('legend', null, label),
          React.createElement(
            'select',
            {
              name: 'product-group',
              onChange: event => setIndex(event.currentTarget.selectedIndex)
            },
            root.map(item =>
              React.createElement('option', { key: item.id, value: item.id }, item.name)
            )
          )
        ),
        React.createElement(SubGroupFilter, {
          depth: depth + 1,
          label: `Subgroup - ${root[index]?.name || 'Unknown'}`,
          root: items,
          action: action
        })
      );
    }

    function SearchForm({ root, action }) {
      return React.createElement(
        React.Fragment,
        null,
        React.createElement('span', null, 'Search Form'),
        React.createElement(
          'form',
          null,
          React.createElement(SubGroupFilter, {
            depth: 0,
            label: 'Product groups',
            root: root,
            action: action
          }),
          React.createElement('button', { className: 'button' }, 'search')
        )
      );
    }

    const root = ReactNoop.createRoot();

    await act(async () => {
      root.render(
        React.createElement(SearchForm, {
          root: [
            { id: "foo1", name: "Foo1" },
            { id: "foo2", name: "Foo2" }
          ],
          action: () => {}
        })
      );
    });

    // This should not trigger the static flag error
    expect(didWarnAboutStaticFlag).toBe(false);
  });
});