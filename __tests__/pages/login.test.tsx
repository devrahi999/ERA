import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, vi, describe } from 'vitest';
import LoginPage from '@/app/login/page';

// Mock the Auth Context
const mockLogin = vi.fn();
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isLoading: false,
  })
}));

// Mock the server action: the page awaits it and hands the returned user to login()
const mockLoginAction = vi.fn();
vi.mock('@/app/login/actions', () => ({
  loginAction: (...args: unknown[]) => mockLoginAction(...args),
  logoutAction: vi.fn(),
}));

const TEST_USER = { id: 'u1', email: 'admin@esporta.com', role: 'admin' };

describe('Login Page', () => {
  test('renders login form correctly', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  });

  test('submits credentials to the server action and logs the returned user in', async () => {
    mockLoginAction.mockResolvedValueOnce({ user: TEST_USER });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'admin@esporta.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(mockLoginAction).toHaveBeenCalledWith('admin@esporta.com', 'password123');
    });
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(TEST_USER);
    });
  });

  test('displays the error message returned by the login action', async () => {
    mockLoginAction.mockResolvedValueOnce({ error: 'Invalid login credentials' });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'wrong@esporta.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });

    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });
});

