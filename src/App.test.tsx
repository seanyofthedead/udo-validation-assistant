// @vitest-environment jsdom
// Task 3.1 — app shell + routing. Renders without console errors; nav switches
// between the six screens.

import './test/setup';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import App from './App';
import { SCREENS } from './screens';

afterEach(cleanup);

describe('App shell', () => {
  it('renders the title and defaults to the Executive Dashboard', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: /UDO Validation Assistant/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Executive Dashboard' }),
    ).toBeInTheDocument();
  });

  it('exposes a nav button for each of the six screens', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: /screens/i });
    for (const s of SCREENS) {
      expect(within(nav).getByRole('button', { name: s.label })).toBeInTheDocument();
    }
  });

  it('switches screens when a nav button is clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'UDO Inventory' }));
    expect(screen.getByRole('heading', { level: 2, name: 'UDO Inventory' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reporting / Export' }));
    expect(
      screen.getByRole('heading', { level: 2, name: 'Reporting / Export' }),
    ).toBeInTheDocument();
  });

  it('marks the active screen with aria-current', () => {
    render(<App />);
    const inventoryBtn = screen.getByRole('button', { name: 'UDO Inventory' });
    fireEvent.click(inventoryBtn);
    expect(inventoryBtn).toHaveAttribute('aria-current', 'page');
  });

  it('renders without writing to console.error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'High-Risk Queue' }));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
