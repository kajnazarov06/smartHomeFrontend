import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../api/endpoints';
import { ApiError } from '../api/client';
import { renderWithProviders } from '../test/utils';
import { validationError } from '../test/fixtures';
import { SignIn, SignUp } from './Auth';

vi.mock('../api/endpoints');
vi.mock('../lib/echo');

function setup(Page, { status = { has_users: true, registration_open: true }, route = '/login' } = {}) {
  api.me.mockResolvedValue(null);
  api.authStatus.mockResolvedValue(status);
  return renderWithProviders(<Page />, { route, path: route });
}

const location = () => screen.getByTestId('location');

describe('SignIn', () => {
  const fill = async (login, password) => {
    if (login) await userEvent.type(screen.getByLabelText('Email or username'), login);
    if (password) await userEvent.type(screen.getByLabelText('Password'), password);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  };

  it('validates empty fields without calling the API', async () => {
    setup(SignIn);
    await fill();
    expect(screen.getByText('Enter your email or username.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  it('signs in and goes to the dashboard', async () => {
    setup(SignIn);
    api.login.mockResolvedValue({ id: 1, email: 'me@example.com' });
    await fill(' aziz ', 'secret123');
    expect(api.login.mock.calls[0][0]).toEqual({ login: 'aziz', password: 'secret123', remember: true });
    await waitFor(() => expect(location()).toHaveTextContent(/^\/$/));
  });

  it('shows a generic banner for wrong credentials', async () => {
    setup(SignIn);
    api.login.mockRejectedValue(validationError({ login: ['These credentials do not match our records.'] }));
    await fill('aziz', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect. Check them and try again.');
  });

  it('shows the throttle message on 429', async () => {
    setup(SignIn);
    api.login.mockRejectedValue(new ApiError({ status: 429, errors: { login: ['Too many login attempts. Try in 60 s.'] } }));
    await fill('aziz', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many login attempts. Try in 60 s.');
  });

  it('shows a default throttle message', async () => {
    setup(SignIn);
    api.login.mockRejectedValue(new ApiError({ status: 429 }));
    await fill('aziz', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Wait a minute and try again.');
  });

  it('puts other validation errors under their fields', async () => {
    setup(SignIn);
    api.login.mockRejectedValue(validationError({ password: ['The password field is required.'] }));
    await fill('aziz', 'x');
    expect(await screen.findByText('The password field is required.')).toBeInTheDocument();
  });

  it('describes other failures', async () => {
    setup(SignIn);
    api.login.mockRejectedValue(new ApiError({ status: 0, code: 'network_error' }));
    await fill('aziz', 'x');
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the local server");
  });

  it('sends a first-time visitor to registration', async () => {
    setup(SignIn, { status: { has_users: false, registration_open: true } });
    await waitFor(() => expect(location()).toHaveTextContent('/register'));
  });

  it('hides the sign-up link when registration is closed', async () => {
    setup(SignIn, { status: { has_users: true, registration_open: false } });
    await waitFor(() => expect(api.authStatus).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Create account' })).not.toBeInTheDocument());
  });
});

describe('SignUp', () => {
  const route = '/register';
  const fill = async (email, password, confirm) => {
    if (email) await userEvent.type(screen.getByLabelText('Email'), email);
    if (password) await userEvent.type(screen.getByLabelText('Password'), password);
    if (confirm) await userEvent.type(screen.getByLabelText('Confirm password'), confirm);
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  };

  it('validates email, length and confirmation', async () => {
    setup(SignUp, { route });
    await fill('nope', 'short', 'other');
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
    expect(api.register).not.toHaveBeenCalled();
  });

  it('registers and goes to the dashboard', async () => {
    setup(SignUp, { route });
    api.register.mockResolvedValue({ id: 1, email: 'me@example.com' });
    await fill(' me@example.com ', 'longpassword', 'longpassword');
    expect(api.register.mock.calls[0][0]).toEqual({
      email: 'me@example.com',
      password: 'longpassword',
      password_confirmation: 'longpassword',
    });
    await waitFor(() => expect(location()).toHaveTextContent(/^\/$/));
  });

  it('maps server validation errors to fields', async () => {
    setup(SignUp, { route });
    api.register.mockRejectedValue(validationError({ email: ['The email has already been taken.'] }));
    await fill('me@example.com', 'longpassword', 'longpassword');
    expect(await screen.findByText('The email has already been taken.')).toBeInTheDocument();
  });

  it('blocks sign-up when registration is closed', async () => {
    setup(SignUp, { route, status: { has_users: true, registration_open: false } });
    expect(await screen.findByText(/Registration is closed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });

  it('welcomes the first account', async () => {
    setup(SignUp, { route, status: { has_users: false, registration_open: true } });
    expect(await screen.findByText('Set up the first account for this home.')).toBeInTheDocument();
  });
});
